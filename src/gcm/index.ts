import Long from "long";
import protobuf from "protobufjs";
import type { Root, Type } from "protobufjs";
import fcmKey from "../fcm/serverKey.js";
import type { ICredentials } from "../types.js";
import { toBase64 } from "../utils/base64.js";
import { resolveAssetPath } from "../utils/module-path.js";
import request from "../utils/request.js";
import { waitFor } from "../utils/timeout.js";

// Hack to fix PHONE_REGISTRATION_ERROR #17 when bundled with protobufjs.
// https://github.com/dcodeIO/protobuf.js#browserify-integration
protobuf.util.Long = Long;
protobuf.configure();

const serverKey = toBase64(Buffer.from(fcmKey));

const REGISTER_URL = "https://android.clients.google.com/c2dm/register3";
const CHECKIN_URL = "https://android.clients.google.com/checkin";

let root: Root | null = null;
let androidCheckinResponse: Type | null = null;

export interface ICheckinResponse {
    "statsOk": boolean;
    "timeMsec": string;
    "androidId": string;
    "securityToken": string;
    "versionInfo": string;
}

export async function register (appId: string): Promise<ICredentials["gcm"]> {
    const options = await checkIn();
    return doRegister(options, appId);
}

export async function checkIn (androidId?: string, securityToken?: string): Promise<ICheckinResponse> {
    await loadProtoFile();

    if (!androidCheckinResponse) {
        throw new Error("AndroidCheckinResponse type not initialized");
    }

    const buffer = getCheckinRequest(androidId, securityToken);
    const body = await request<Buffer>({
        "url": CHECKIN_URL,
        "method": "POST",
        "headers": {
            "Content-Type": "application/x-protobuf"
        },
        "body": buffer,
        "encoding": null
    });
    const message = androidCheckinResponse.decode(body);
    return androidCheckinResponse.toObject(message, {
        "longs": String,
        "enums": String,
        "bytes": String
    }) as ICheckinResponse;
}

interface IDoRegisterArgs {
    "androidId": string;
    "securityToken": string;
}

async function doRegister ({ androidId, securityToken }: IDoRegisterArgs, appId: string): Promise<ICredentials["gcm"]> {
    const body = {
        "app": "org.chromium.linux",
        "X-subtype": appId,
        "device": androidId,
        "sender": serverKey
    };
    const response = await postRegister({
        androidId,
        securityToken,
        body
    });
    const token = response.split("=")[1];

    if (!token) {
        throw new Error(`Unexpected register response: ${response}`);
    }

    return {
        token,
        androidId,
        securityToken,
        appId
    };
}

interface IPostRegisterArgs {
    "androidId": string;
    "securityToken": string;
    "body": {
        "app": string;
        "X-subtype": string;
        "device": string;
        "sender": string;
    };
    "retry"?: number;
}

async function postRegister ({ androidId, securityToken, body, retry = 0 }: IPostRegisterArgs): Promise<string> {
    const response = await request<string>({
        "url": REGISTER_URL,
        "method": "POST",
        "headers": {
            "Authorization": `AidLogin ${androidId}:${securityToken}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        "form": body
    });

    if (!response.includes("Error")) {
        return response;
    }

    console.warn(`Register request has failed with ${response}`);
    if (retry >= 5) {
        throw new Error("GCM register has failed");
    }

    console.warn(`Retry... ${retry + 1}`);
    await waitFor(1000);
    return postRegister({
        androidId,
        securityToken,
        body,
        "retry": retry + 1
    });
}

async function loadProtoFile (): Promise<Root> {
    if (root) {
        return root;
    }

    root = await protobuf.load(resolveAssetPath(import.meta.url, "./checkin.proto"));
    androidCheckinResponse = root.lookupType("checkin_proto.AndroidCheckinResponse");
    return root;
}

function getCheckinRequest (androidId?: string, securityToken?: string): Uint8Array {
    if (!root) {
        throw new Error("GCM proto root not initialized");
    }

    const androidCheckinRequest = root.lookupType("checkin_proto.AndroidCheckinRequest");
    const payload = {
        "userSerialNumber": 0,
        "checkin": {
            "type": 3,
            "chromeBuild": {
                "platform": 2,
                "chromeVersion": "63.0.3234.0",
                "channel": 1
            }
        },
        "version": 3,
        "id": androidId ? Long.fromString(androidId) : undefined,
        "securityToken": securityToken ? Long.fromString(securityToken, true) : undefined
    };
    const errorMessage = androidCheckinRequest.verify(payload);

    if (errorMessage) {
        throw new Error(errorMessage);
    }

    const message = androidCheckinRequest.create(payload);
    return androidCheckinRequest.encode(message).finish();
}
