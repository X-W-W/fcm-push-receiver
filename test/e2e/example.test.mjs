import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

test("example guides the user when firebase.json is missing", () => {
    const result = spawnSync("pnpm", ["exec", "esno", "example/index.ts"], {
        "cwd": repoRoot,
        "encoding": "utf8"
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /firebase\.json/i);
    assert.match(result.stderr, /firebase\.template\.json/i);
    assert.doesNotMatch(result.stderr, /ENOENT/);
});
