import test from "node:test";
import assert from "node:assert/strict";
import tls from "node:tls";

import Client from "../../dist/client.js";

function createCredentials () {
    return {
        "gcm": {
            "token": "token",
            "androidId": "123456789",
            "securityToken": "987654321",
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
    };
}

test("client connect creates the TLS socket via tls.connect", (t) => {
    const client = new Client(createCredentials(), []);
    const fakeSocket = {
        "setKeepAlive": () => undefined,
        "on": () => fakeSocket,
        "write": () => true,
        "removeListener": () => fakeSocket,
        "destroy": () => undefined
    };

    t.mock.method(tls.TLSSocket.prototype, "connect", () => undefined);
    const connectMock = t.mock.method(tls, "connect", () => fakeSocket);

    client._connect();

    assert.equal(connectMock.mock.callCount(), 1);
    assert.equal(client._socket, fakeSocket);
});
