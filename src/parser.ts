import EventEmitter from "node:events";
import tls from "node:tls";
import protobuf from "protobufjs";
import type { Root, Type } from "protobufjs";
import {
    MCS_VERSION_TAG_AND_SIZE,
    MCS_TAG_AND_SIZE,
    MCS_SIZE,
    MCS_PROTO_BYTES,
    kVersionPacketLen,
    kTagPacketLen,
    kSizePacketLenMin,
    kMCSVersion,
    kHeartbeatPingTag,
    kHeartbeatAckTag,
    kLoginRequestTag,
    kLoginResponseTag,
    kCloseTag,
    kIqStanzaTag,
    kDataMessageStanzaTag,
    kStreamErrorStanzaTag
} from "./constants.js";
import { resolveAssetPath } from "./utils/module-path.js";
import { NOOP } from "./utils/index.js";

const DEBUG = NOOP;
const { BufferReader, load } = protobuf;

let proto: Root | null = null;

class Parser extends EventEmitter {

    private _socket: tls.TLSSocket;

    private _state: number;

    private _data: Buffer;

    private _sizePacketSoFar: number;

    private _messageTag: number;

    private _messageSize: number;

    private _handshakeComplete: boolean;

    private _isWaitingForData: boolean;

    static async init () {
        if (proto) {
            return;
        }
        proto = await load(resolveAssetPath(import.meta.url, "./mcs.proto"));
    }

    constructor (socket: tls.TLSSocket) {
        super();
        this._socket = socket;
        this._state = MCS_VERSION_TAG_AND_SIZE;
        this._data = Buffer.alloc(0);
        this._sizePacketSoFar = 0;
        this._messageTag = 0;
        this._messageSize = 0;
        this._handshakeComplete = false;
        this._isWaitingForData = true;
        this._onData = this._onData.bind(this);
        this._socket.on("data", this._onData);
    }

    destroy () {
        this._isWaitingForData = false;
        this._socket.removeListener("data", this._onData);
    }

    private _emitError (error: Error) {
        this.destroy();
        this.emit("error", error);
    }

    private _onData (buffer: Buffer) {
        DEBUG(`Got data: ${buffer.length}`);
        this._data = Buffer.concat([this._data, buffer]);
        if (this._isWaitingForData) {
            this._isWaitingForData = false;
            this._waitForData();
        }
    }

    private _waitForData () {
        DEBUG(`waitForData state: ${this._state}`);

        let minBytesNeeded = 0;

        switch (this._state) {
            case MCS_VERSION_TAG_AND_SIZE:
                minBytesNeeded = kVersionPacketLen + kTagPacketLen + kSizePacketLenMin;
                break;
            case MCS_TAG_AND_SIZE:
                minBytesNeeded = kTagPacketLen + kSizePacketLenMin;
                break;
            case MCS_SIZE:
                minBytesNeeded = this._sizePacketSoFar + 1;
                break;
            case MCS_PROTO_BYTES:
                minBytesNeeded = this._messageSize;
                break;
            default:
                this._emitError(new Error(`Unexpected state: ${this._state}`));
                return;
        }

        if (this._data.length < minBytesNeeded) {
            DEBUG(`Socket read finished prematurely. Waiting for ${minBytesNeeded - this._data.length} more bytes`);
            this._isWaitingForData = true;
            return;
        }

        DEBUG(`Processing MCS data: state == ${this._state}`);

        switch (this._state) {
            case MCS_VERSION_TAG_AND_SIZE:
                this._onGotVersion();
                return;
            case MCS_TAG_AND_SIZE:
                this._onGotMessageTag();
                return;
            case MCS_SIZE:
                this._onGotMessageSize();
                return;
            case MCS_PROTO_BYTES:
                this._onGotMessageBytes();
                return;
            default:
                this._emitError(new Error(`Unexpected state: ${this._state}`));
        }
    }

    private _onGotVersion () {
        const version = this._data.readInt8(0);
        this._data = this._data.slice(1);
        DEBUG(`VERSION IS ${version}`);

        if (version < kMCSVersion && version !== 38) {
            this._emitError(new Error(`Got wrong version: ${version}`));
            return;
        }

        this._onGotMessageTag();
    }

    private _onGotMessageTag () {
        this._messageTag = this._data.readInt8(0);
        this._data = this._data.slice(1);
        DEBUG(`RECEIVED PROTO OF TYPE ${this._messageTag}`);
        this._onGotMessageSize();
    }

    private _onGotMessageSize () {
        let incompleteSizePacket = false;
        const reader = new BufferReader(this._data);

        try {
            this._messageSize = reader.int32();
        } catch (error) {
            if (error instanceof Error && error.message.startsWith("index out of range:")) {
                incompleteSizePacket = true;
            } else if (error instanceof Error) {
                this._emitError(error);
                return;
            } else {
                this._emitError(new Error("Unknown error"));
                return;
            }
        }

        if (incompleteSizePacket) {
            this._sizePacketSoFar = reader.pos;
            this._state = MCS_SIZE;
            this._waitForData();
            return;
        }

        this._data = this._data.slice(reader.pos);
        DEBUG(`Proto size: ${this._messageSize}`);
        this._sizePacketSoFar = 0;

        if (this._messageSize > 0) {
            this._state = MCS_PROTO_BYTES;
            this._waitForData();
        } else {
            this._onGotMessageBytes();
        }
    }

    private _onGotMessageBytes () {
        const protobufType = this._buildProtobufFromTag(this._messageTag);
        if (!protobufType) {
            this._emitError(new Error("Unknown tag"));
            return;
        }

        if (this._messageSize === 0) {
            this.emit("message", { "tag": this._messageTag,
                "object": {} });
            this._getNextMessage();
            return;
        }

        if (this._data.length < this._messageSize) {
            DEBUG(`Continuing data read. Buffer size is ${this._data.length}, expecting ${this._messageSize}`);
            this._state = MCS_PROTO_BYTES;
            this._waitForData();
            return;
        }

        const buffer = this._data.slice(0, this._messageSize);
        this._data = this._data.slice(this._messageSize);
        const message = protobufType.decode(buffer);
        const object = protobufType.toObject(message, {
            "longs": String,
            "enums": String,
            "bytes": Buffer
        });

        this.emit("message", { "tag": this._messageTag,
            "object": object });

        if (this._messageTag === kLoginResponseTag) {
            if (this._handshakeComplete) {
                console.error("Unexpected login response");
            } else {
                this._handshakeComplete = true;
                DEBUG("GCM Handshake complete.");
            }
        }

        this._getNextMessage();
    }

    private _getNextMessage () {
        this._messageTag = 0;
        this._messageSize = 0;
        this._state = MCS_TAG_AND_SIZE;
        this._waitForData();
    }

    private _buildProtobufFromTag (tag: number): Type | null {
        if (!proto) {
            throw new Error("Parser not initialized");
        }

        switch (tag) {
            case kHeartbeatPingTag:
                return proto.lookupType("mcs_proto.HeartbeatPing");
            case kHeartbeatAckTag:
                return proto.lookupType("mcs_proto.HeartbeatAck");
            case kLoginRequestTag:
                return proto.lookupType("mcs_proto.LoginRequest");
            case kLoginResponseTag:
                return proto.lookupType("mcs_proto.LoginResponse");
            case kCloseTag:
                return proto.lookupType("mcs_proto.Close");
            case kIqStanzaTag:
                return proto.lookupType("mcs_proto.IqStanza");
            case kDataMessageStanzaTag:
                return proto.lookupType("mcs_proto.DataMessageStanza");
            case kStreamErrorStanzaTag:
                return proto.lookupType("mcs_proto.StreamErrorStanza");
            default:
                return null;
        }
    }
}

export default Parser;
