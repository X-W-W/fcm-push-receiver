import test from "node:test";
import assert from "node:assert/strict";

import Client from "../../dist/client.js";
import Parser from "../../dist/parser.js";

test("compiled client and parser load protobuf assets from dist", async () => {
    await assert.doesNotReject(async () => {
        await Client.init();
        await Parser.init();
    });
});
