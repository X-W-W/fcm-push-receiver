import test from "node:test";
import assert from "node:assert/strict";
import EventEmitter from "node:events";

let originalConsoleLog;

test.beforeEach(() => {
    originalConsoleLog = console.log;
});

test.afterEach(() => {
    console.log = originalConsoleLog;
});

test("runtime logs the full token and connection status", async () => {
    const messages = [];
    console.log = (...args) => {
        messages.push(args.join(" "));
    };

    const {
        attachLifecycleLogging,
        logReceiverReady
    } = await import("../../example/runtime.mjs");

    const client = new EventEmitter();

    logReceiverReady("full-token-value");
    attachLifecycleLogging(client);

    client.emit("connect");
    client.emit("disconnect");

    assert.deepEqual(messages, [
        "FCM token: full-token-value",
        "Connecting to FCM...",
        "Connected to FCM",
        "Disconnected from FCM"
    ]);
});
