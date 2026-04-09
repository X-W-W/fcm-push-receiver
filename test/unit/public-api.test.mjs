import test from "node:test";
import assert from "node:assert/strict";

import { listen } from "../../dist/index.js";

const noop = () => undefined;

test("listen rejects when credentials are missing", async () => {
    await assert.rejects(listen(undefined, noop), /Missing credentials/);
});

test("listen rejects when gcm.androidId is missing", async () => {
    await assert.rejects(
        listen({
            "gcm": {
                "token": "token",
                "androidId": "",
                "securityToken": "security-token",
                "appId": "app-id"
            },
            "keys": {
                "privateKey": "private-key",
                "publicKey": "public-key",
                "authSecret": "auth-secret"
            },
            "fcm": {
                "name": "name",
                "token": "fcm-token",
                "web": {
                    "endpoint": "https://example.com",
                    "p256dh": "p256dh",
                    "auth": "auth",
                    "applicationPubKey": "applicationPubKey"
                }
            }
        }, noop),
        /Missing gcm\.androidId/
    );
});
