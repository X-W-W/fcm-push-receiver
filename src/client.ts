import EventEmitter from "node:events";
import net from "node:net";
import tls from "node:tls";
import Long from "long";
import protobuf from "protobufjs";
import type { Root } from "protobufjs";
import {
    kDataMessageStanzaTag,
    kLoginRequestTag,
    kLoginResponseTag,
    kMCSVersion
} from "./constants.js";
import { checkIn } from "./gcm/index.js";
import Parser from "./parser.js";
import type {
    ICredentials,
    IDataMessageStanza,
    INotificationData
} from "./types.js";
import decrypt from "./utils/decrypt.js";
import { resolveAssetPath } from "./utils/module-path.js";

const HOST = "mtalk.google.com";
const PORT = 5228;
const MAX_RETRY_TIMEOUT = 15;
const { load } = protobuf;

let proto: Root | null = null;

class Client extends EventEmitter {
    private _credentials: ICredentials;

    private _persistentIds: string[];

    private _socket: tls.TLSSocket | null = null;

    private _parser: Parser | null = null;

    private _retryCount: number;

    private _retryTimeout: NodeJS.Timeout | null = null;

    static async init () {
        if (proto) {
            return;
        }
        proto = await load(resolveAssetPath(import.meta.url, "./mcs.proto"));
    }

    constructor (credentials: ICredentials, persistentIds?: string[]) {
        super();
        this._credentials = credentials;
        this._persistentIds = persistentIds ?? [];
        this._retryCount = 0;
        this._onSocketConnect = this._onSocketConnect.bind(this);
        this._onSocketClose = this._onSocketClose.bind(this);
        this._onSocketError = this._onSocketError.bind(this);
        this._onMessage = this._onMessage.bind(this);
        this._onParserError = this._onParserError.bind(this);
    }

    async connect () {
        await Client.init();
        await this._checkIn();
        this._connect();
        if (!this._socket) {
            return;
        }
        await Parser.init();
        if (!this._socket) {
            return;
        }
        this._parser = new Parser(this._socket);
        this._parser.on("message", this._onMessage);
        this._parser.on("error", this._onParserError);
    }

    destroy () {
        this._destroy();
    }

    private async _checkIn () {
        return checkIn(
            this._credentials.gcm.androidId,
            this._credentials.gcm.securityToken
        );
    }

    private _connect () {
        this._socket = new tls.TLSSocket(new net.Socket());
        this._socket.setKeepAlive(true);
        this._socket.on("connect", this._onSocketConnect);
        this._socket.on("close", this._onSocketClose);
        this._socket.on("error", this._onSocketError);
        this._socket.connect({ "host": HOST,
            "port": PORT });
        this._socket.write(this._loginBuffer());
    }

    private _destroy () {
        if (this._retryTimeout) {
            clearTimeout(this._retryTimeout);
        }
        if (this._socket) {
            this._socket.removeListener("connect", this._onSocketConnect);
            this._socket.removeListener("close", this._onSocketClose);
            this._socket.removeListener("error", this._onSocketError);
            this._socket.destroy();
            this._socket = null;
        }
        if (this._parser) {
            this._parser.removeListener("message", this._onMessage);
            this._parser.removeListener("error", this._onParserError);
            this._parser.destroy();
            this._parser = null;
        }
    }

    private _loginBuffer (): Buffer {
        if (!proto) {
            return Buffer.from([]);
        }

        const loginRequestType = proto.lookupType("mcs_proto.LoginRequest");
        const hexAndroidId = Long.fromString(
            this._credentials.gcm.androidId
        ).toString(16);
        const loginRequest = {
            "adaptiveHeartbeat": false,
            "authService": 2,
            "authToken": this._credentials.gcm.securityToken,
            "id": "chrome-63.0.3234.0",
            "domain": "mcs.android.com",
            "deviceId": `android-${hexAndroidId}`,
            "networkType": 1,
            "resource": this._credentials.gcm.androidId,
            "user": this._credentials.gcm.androidId,
            "useRmq2": true,
            "setting": [{ "name": "new_vc",
                "value": "1" }],
            "clientEvent": [],
            "receivedPersistentId": this._persistentIds
        };

        const errorMessage = loginRequestType.verify(loginRequest);
        if (errorMessage) {
            throw new Error(errorMessage);
        }

        const buffer = loginRequestType.encodeDelimited(loginRequest).finish();
        return Buffer.concat([
            Buffer.from([kMCSVersion, kLoginRequestTag]),
            buffer
        ]);
    }

    private _onSocketConnect () {
        this._retryCount = 0;
        this.emit("connect");
    }

    private _onSocketClose () {
        this.emit("disconnect");
        this._retry();
    }

    private _onSocketError (error: Error) {
        console.error("[fcm-push-receiver] _onSocketError:", error);
    }

    private _onParserError (error: Error) {
        console.error("[fcm-push-receiver] _onParserError:", error);
        this._retry();
    }

    private _retry () {
        this._destroy();
        const timeout = Math.min(++this._retryCount, MAX_RETRY_TIMEOUT) * 1000;
        this._retryTimeout = setTimeout(() => {
            void this.connect();
        }, timeout);
    }

    private _onMessage ({ tag, object }: { "tag": number;
        "object": unknown; }) {
        if (tag === kLoginResponseTag) {
            this._persistentIds = [];
            return;
        }

        if (tag === kDataMessageStanzaTag) {
            this._onDataMessage(object as IDataMessageStanza);
        }
    }

    private _onDataMessage (object: IDataMessageStanza) {
        if (this._persistentIds.includes(object.persistentId)) {
            return;
        }

        let message: INotificationData<Record<string, unknown>>;
        try {
            message = decrypt<INotificationData<Record<string, unknown>>>(
                object,
                this._credentials.keys
            );
        } catch (error) {
            if (!(error instanceof Error)) {
                throw error;
            }

            const messageText = error.message;
            switch (true) {
                case messageText.includes(
                    "Unsupported state or unable to authenticate data"
                ):
                case messageText.includes("crypto-key is missing"):
                case messageText.includes("salt is missing"):
                    console.warn(
                        `Message dropped as it could not be decrypted: ${messageText}`
                    );
                    this._persistentIds.push(object.persistentId);
                    return;
                default:
                    throw error;
            }
        }

        this._persistentIds.push(object.persistentId);
        this.emit("ON_NOTIFICATION_RECEIVED", {
            "notification": message,
            "persistentId": object.persistentId
        });
    }
}

export default Client;
