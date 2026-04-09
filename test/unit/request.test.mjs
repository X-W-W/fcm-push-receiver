import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const requestModulePath = new URL("../../dist/utils/request.js", import.meta.url);
const requestModuleSource = await readFile(requestModulePath, "utf8");
const legacyClientName = "request" + "-promise";

let originalFetch;
const originalSetTimeout = globalThis.setTimeout;
const originalConsoleError = console.error;

async function loadRequest () {
    const module = await import("../../dist/utils/request.js");
    return module.default;
}

function installFetchMock (implementation) {
    originalFetch = globalThis.fetch;
    globalThis.fetch = implementation;
}

function restoreFetchMock () {
    if (originalFetch) {
        globalThis.fetch = originalFetch;
        originalFetch = undefined;
        return;
    }

    delete globalThis.fetch;
}

test.afterEach(() => {
    restoreFetchMock();
    globalThis.setTimeout = originalSetTimeout;
    console.error = originalConsoleError;
});

test("request helper is compiled from the native fetch implementation", () => {
    assert.equal(requestModuleSource.includes(legacyClientName), false);
});

test("request helper sends JSON bodies and parses JSON responses", async () => {
    const request = await loadRequest();
    const responseBody = {
        "name": "installation",
        "refreshToken": "refresh-token"
    };

    installFetchMock(async (url, init = {}) => {
        assert.equal(url, "https://example.com/installations");
        assert.equal(init.method, "POST");
        assert.match(init.headers["Content-Type"], /application\/json/i);
        assert.equal(init.headers.Authorization, "Bearer token");
        assert.equal(init.body, JSON.stringify({ "appId": "demo-app" }));

        return new Response(JSON.stringify(responseBody), {
            "status": 200,
            "headers": {
                "Content-Type": "application/json"
            }
        });
    });

    const response = await request({
        "url": "https://example.com/installations",
        "method": "POST",
        "headers": {
            "Authorization": "Bearer token"
        },
        "body": {
            "appId": "demo-app"
        },
        "json": true
    });

    assert.deepEqual(response, responseBody);
});

test("request helper form-encodes payloads and returns text responses", async () => {
    const request = await loadRequest();

    installFetchMock(async (url, init = {}) => {
        assert.equal(url, "https://example.com/register3");
        assert.equal(init.method, "POST");
        assert.match(init.headers["Content-Type"], /application\/x-www-form-urlencoded/i);
        assert.equal(init.body, "app=org.chromium.linux&device=android-id&sender=server-key");

        return new Response("token=registered-token", {
            "status": 200
        });
    });

    const response = await request({
        "url": "https://example.com/register3",
        "method": "POST",
        "form": {
            "app": "org.chromium.linux",
            "device": "android-id",
            "sender": "server-key"
        }
    });

    assert.equal(response, "token=registered-token");
});

test("request helper returns Buffers for binary responses", async () => {
    const request = await loadRequest();
    const bytes = Uint8Array.from([1, 2, 3, 4]);

    installFetchMock(async () => new Response(bytes, {
        "status": 200,
        "headers": {
            "Content-Type": "application/x-protobuf"
        }
    }));

    const response = await request({
        "url": "https://example.com/checkin",
        "method": "POST",
        "body": Buffer.from([9, 8, 7]),
        "encoding": null
    });

    assert.equal(Buffer.isBuffer(response), true);
    assert.deepEqual([...response], [...bytes]);
});

test("request helper retries once after a failed fetch attempt", async () => {
    const request = await loadRequest();
    let attempts = 0;

    console.error = () => undefined;
    installFetchMock(async () => {
        attempts += 1;
        if (attempts === 1) {
            throw new Error("temporary failure");
        }

        return new Response("recovered", {
            "status": 200
        });
    });

    const response = await request({
        "url": "https://example.com/retry",
        "method": "POST"
    });

    assert.equal(response, "recovered");
    assert.equal(attempts, 2);
});

test("request helper stops retrying after repeated server errors", async () => {
    const request = await loadRequest();
    const scheduledTimeouts = [];
    let attempts = 0;

    globalThis.setTimeout = (callback, timeout = 0) => {
        scheduledTimeouts.push(timeout);
        callback();
        return 0;
    };
    console.error = () => undefined;
    installFetchMock(async () => {
        attempts += 1;
        return new Response("busy", {
            "status": 503,
            "statusText": "Service Unavailable"
        });
    });

    await assert.rejects(
        request({
            "url": "https://example.com/retry-limit",
            "method": "POST"
        }),
        /503 Service Unavailable/
    );

    assert.equal(attempts, 4);
    assert.deepEqual(scheduledTimeouts, [0, 5000, 10000]);
});

test("request helper throws on non-2xx responses without retrying client errors", async () => {
    const request = await loadRequest();
    let attempts = 0;

    installFetchMock(async () => {
        attempts += 1;
        return new Response("bad request", {
            "status": 400,
            "statusText": "Bad Request"
        });
    });

    await assert.rejects(
        request({
            "url": "https://example.com/installations",
            "method": "POST",
            "json": true,
            "body": {
                "appId": "demo-app"
            }
        }),
        /400 Bad Request/
    );

    assert.equal(attempts, 1);
});
