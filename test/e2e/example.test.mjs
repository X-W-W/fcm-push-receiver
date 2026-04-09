import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

test("example guides the user when firebase.json is missing", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "fcm-push-receiver-example-"));
    const fixtureRoot = join(tempRoot, "fixture");

    cpSync(join(repoRoot, "example"), join(fixtureRoot, "example"), {
        "recursive": true
    });
    cpSync(join(repoRoot, "dist"), join(fixtureRoot, "dist"), {
        "recursive": true
    });
    cpSync(join(repoRoot, "node_modules"), join(fixtureRoot, "node_modules"), {
        "recursive": true
    });
    cpSync(
        join(repoRoot, "package.json"),
        join(fixtureRoot, "package.json")
    );
    cpSync(
        join(repoRoot, "firebase.template.json"),
        join(fixtureRoot, "firebase.template.json")
    );

    const result = spawnSync("node", ["example/index.ts"], {
        "cwd": fixtureRoot,
        "encoding": "utf8"
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /firebase\.json/i);
    assert.match(result.stderr, /firebase\.template\.json/i);
    assert.doesNotMatch(result.stderr, /ENOENT/);
});
