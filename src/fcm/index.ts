import crypto from "node:crypto";
import { escape } from "../utils/base64.js";
import request from "../utils/request.js";
import type { ICredentials, ICredentialsKeys, IFirebaseConfig, IInstallFCMResponse } from "../types.js";

const FIREBASE_INSTALLATION = "https://firebaseinstallations.googleapis.com/v1/";
const FCM_REGISTRATION = "https://fcmregistrations.googleapis.com/v1/";
const FCM_ENDPOINT = "https://fcm.googleapis.com/fcm/send";

const fidRegex = /^[cdef][\w-]{21}$/;

function generateFirebaseFID () {
    // A valid FID is 22 base64 characters (132 bits, or 16.5 bytes), so we
    // generate 17 random bytes and trim the encoded form back to 22 chars.
    const fid = crypto.randomBytes(17);
    // Replace the first 4 random bits with the constant FID header 0b0111.
    fid[0] = 0b01110000 + fid[0] % 0b00010000;

    const fidResult = fid.toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .substring(0, 22);

    return fidRegex.test(fidResult) ? fidResult : "";
}

export async function installFCM (config: IFirebaseConfig): Promise<IInstallFCMResponse> {
    const response = await request({
        "url": `${FIREBASE_INSTALLATION}projects/${config.firebase.projectId}/installations`,
        "method": "POST",
        "headers": {
            "x-firebase-client": Buffer.from(
                JSON.stringify({
                    "heartbeats": [],
                    "version": 2
                })
            ).toString("base64"),
            "x-goog-api-key": config.firebase.apiKey
        },
        "body": {
            "appId": config.firebase.appId,
            "authVersion": "FIS_v2",
            "fid": generateFirebaseFID(),
            "sdkVersion": "w:0.6.4"
        },
        "json": true
    }) as unknown as IInstallFCMResponse;

    return response;
}

interface IRegisterFCMConfig extends IFirebaseConfig {
    "authToken": string;
    "token": string;
}

export async function registerFCM (config: IRegisterFCMConfig): Promise<Pick<ICredentials, "keys" | "fcm">> {
    const keys = await createKeys();
    const response = await request({
        "url": `${FCM_REGISTRATION}projects/${config.firebase.projectId}/registrations`,
        "method": "POST",
        "headers": {
            "x-goog-api-key": config.firebase.apiKey,
            "x-goog-firebase-installations-auth": config.authToken
        },
        "body": {
            "web": {
                "applicationPubKey": config.vapidKey ?? "",
                "auth": keys.authSecret
                    .replace(/=/g, "")
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_"),
                "endpoint": `${FCM_ENDPOINT}/${config.token}`,
                "p256dh": keys.publicKey
                    .replace(/=/g, "")
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_")
            }
        },
        "json": true
    }) as ICredentials["fcm"];

    return {
        keys,
        "fcm": response
    };
}

function createKeys (): Promise<ICredentialsKeys> {
    return new Promise((resolve, reject) => {
        const dh = crypto.createECDH("prime256v1");
        dh.generateKeys();
        crypto.randomBytes(16, (error, buffer) => {
            if (error) {
                reject(error);
                return;
            }

            resolve({
                "privateKey": escape(dh.getPrivateKey("base64")),
                "publicKey": escape(dh.getPublicKey("base64")),
                "authSecret": escape(buffer.toString("base64"))
            });
        });
    });
}
