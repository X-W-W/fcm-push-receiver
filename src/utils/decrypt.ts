import crypto from "node:crypto";
import ece from "http_ece";
import type { IDataMessageStanza, ICredentialsKeys } from "../types.js";

export default decrypt;

// https://tools.ietf.org/html/draft-ietf-webpush-encryption-03
function decrypt<T = Record<string, unknown>> (object: IDataMessageStanza, keys: ICredentialsKeys): T {
    const cryptoKey = object.appData.find(item => item.key === "crypto-key");
    if (!cryptoKey) throw new Error("crypto-key is missing");
    const salt = object.appData.find(item => item.key === "encryption");
    if (!salt) throw new Error("salt is missing");
    const dh = crypto.createECDH("prime256v1");
    dh.setPrivateKey(keys.privateKey, "base64");
    const params = {
        "version": "aesgcm",
        "authSecret": keys.authSecret,
        "dh": cryptoKey.value.slice(3),
        "privateKey": dh,
        "salt": salt.value.slice(5)
    };
    const decrypted = ece.decrypt(object.rawData, params);
    return JSON.parse(Buffer.from(decrypted).toString("utf8")) as T;
}
