import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const legacyClientName = "request" + "-promise";

test("build artifacts include compiled entrypoints and protobuf assets", () => {
    const expectedPaths = [
        "dist/index.js",
        "dist/index.d.ts",
        "dist/client.js",
        "dist/parser.js",
        "dist/mcs.proto",
        "dist/gcm/checkin.proto",
        "dist/gcm/android_checkin.proto"
    ];

    for (const relativePath of expectedPaths) {
        assert.equal(
            existsSync(path.join(repoRoot, relativePath)),
            true,
            `${relativePath} should exist after build`
        );
    }
});

test("compiled package exports the public API", async () => {
    const pkg = await import(new URL("../../dist/index.js", import.meta.url));

    assert.deepEqual(
        Object.keys(pkg).sort(),
        ["listen", "register"]
    );
});

test("register script runs against compiled output without module loader errors", () => {
    const result = spawnSync("node", ["scripts/register/index.js"], {
        "cwd": repoRoot,
        "encoding": "utf8"
    });

    assert.equal(result.status, 0);
    assert.match(result.stderr, /Missing apiKey/);
    assert.doesNotMatch(result.stderr, /Cannot use import statement|ERR_MODULE_NOT_FOUND/);
});

test("listen script runs against compiled output without CommonJS source imports", () => {
    const result = spawnSync("node", ["scripts/listen/index.js"], {
        "cwd": repoRoot,
        "encoding": "utf8"
    });

    assert.equal(result.status, 0);
    assert.match(result.stderr, /Missing credentials/);
    assert.doesNotMatch(result.stderr, /Cannot use import statement|ERR_MODULE_NOT_FOUND/);
});

test("send script runs against compiled output without legacy HTTP client runtime failures", () => {
    const result = spawnSync("node", ["scripts/send/index.js"], {
        "cwd": repoRoot,
        "encoding": "utf8"
    });

    assert.equal(result.status, 0);
    assert.match(result.stderr, /Missing serverKey argument/);
    assert.equal(result.stderr.includes(legacyClientName), false);
    assert.doesNotMatch(result.stderr, /Cannot find package|ERR_MODULE_NOT_FOUND/);
});
