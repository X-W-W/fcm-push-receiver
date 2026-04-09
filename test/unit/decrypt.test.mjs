import test from "node:test";
import assert from "node:assert/strict";

import decrypt from "../../dist/utils/decrypt.js";

const keys = {
    "privateKey": "private-key",
    "publicKey": "public-key",
    "authSecret": "auth-secret"
};

test("decrypt throws when crypto-key is missing", () => {
    assert.throws(() => {
        decrypt({
            "appData": [{ "key": "encryption",
                "value": "salt=abc" }],
            "rawData": Buffer.from([]),
            "persistentId": "1"
        }, keys);
    }, /crypto-key is missing/);
});

test("decrypt throws when salt is missing", () => {
    assert.throws(() => {
        decrypt({
            "appData": [{ "key": "crypto-key",
                "value": "dh=abc" }],
            "rawData": Buffer.from([]),
            "persistentId": "1"
        }, keys);
    }, /salt is missing/);
});
