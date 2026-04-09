import { readFile, writeFile } from "node:fs/promises";
import { listen, register } from "../dist/index.js";
import type {
    ICredentials,
    IFirebaseConfig,
    TNotificationCb
} from "../dist/types.js";
import {
    attachLifecycleLogging,
    logNotification,
    logReceiverReady,
    logRegisteringReceiver,
    logStoredFreshCredentials,
    logUsingStoredCredentials
} from "./runtime.mjs";

const FIREBASE_CONFIG_URL = new URL("../firebase.json", import.meta.url);
const FIREBASE_TEMPLATE_URL = new URL(
    "../firebase.template.json",
    import.meta.url
);
const STORAGE_URL = new URL("../storage.json", import.meta.url);

await main().catch(handleFatalError);

async function main (): Promise<void> {
    const firebaseConfig = await loadFirebaseConfig();
    validateFirebaseConfig(firebaseConfig);

    const credentials = await loadOrRegisterCredentials(firebaseConfig);
    logReceiverReady(credentials.fcm.token);

    const client = await listen(credentials, onNotification(credentials));
    attachLifecycleLogging(client);
}

async function loadFirebaseConfig (): Promise<IFirebaseConfig> {
    try {
        return JSON.parse(
            await readFile(FIREBASE_CONFIG_URL, "utf8")
        ) as IFirebaseConfig;
    } catch (error) {
        if (isMissingFileError(error)) {
            throw new Error(
                `Missing firebase.json. Copy ${FIREBASE_TEMPLATE_URL.pathname.split("/").pop()} to firebase.json and fill in your Firebase project values.`
            );
        }

        throw error;
    }
}

function validateFirebaseConfig (config: IFirebaseConfig): void {
    const missingFields = [
        !config.firebase?.apiKey && "firebase.apiKey",
        !config.firebase?.appId && "firebase.appId",
        !config.firebase?.projectId && "firebase.projectId"
    ].filter(Boolean);

    if (missingFields.length > 0) {
        throw new Error(
            `Missing required Firebase config fields: ${missingFields.join(", ")}`
        );
    }
}

async function loadOrRegisterCredentials (
    firebaseConfig: IFirebaseConfig
): Promise<ICredentials> {
    const storedCredentials = await readStoredCredentials();

    if (storedCredentials) {
        logUsingStoredCredentials();
        storedCredentials.persistentIds ??= [];
        return storedCredentials;
    }

    logRegisteringReceiver();
    const credentials = await register(firebaseConfig);
    credentials.persistentIds = [];
    await persistCredentials(credentials);
    logStoredFreshCredentials();
    return credentials;
}

async function readStoredCredentials (): Promise<ICredentials | null> {
    try {
        return JSON.parse(await readFile(STORAGE_URL, "utf8")) as ICredentials;
    } catch (error) {
        if (isMissingFileError(error)) {
            return null;
        }

        throw error;
    }
}

function onNotification (credentials: ICredentials): TNotificationCb {
    return function handleNotification ({ notification, persistentId }): void {
        logNotification(persistentId, notification);

        credentials.persistentIds ??= [];
        if (!credentials.persistentIds.includes(persistentId)) {
            credentials.persistentIds.push(persistentId);
            void persistCredentials(credentials).catch(handleFatalError);
        }
    };
}

async function persistCredentials (credentials: ICredentials): Promise<void> {
    await writeFile(
        STORAGE_URL,
        `${JSON.stringify(credentials, null, 2)}\n`,
        "utf8"
    );
}

function isMissingFileError (error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function handleFatalError (error: unknown): never {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
