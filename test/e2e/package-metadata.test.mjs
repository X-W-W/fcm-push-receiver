import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8")
);
const legacyClientName = "request" + "-promise";

test("package declares a node engine floor for the ESM runtime contract", () => {
    assert.equal(typeof packageJson.engines?.node, "string");
    assert.match(packageJson.engines.node, /^>=/);
});

test("package no longer declares deprecated request dependencies", () => {
    assert.equal(packageJson.dependencies?.request, undefined);
    assert.equal(packageJson.dependencies?.[legacyClientName], undefined);
    assert.equal(packageJson.devDependencies?.[`@types/${legacyClientName}`], undefined);
});

test("package no longer declares unused legacy Jest-era tooling", () => {
    assert.equal(packageJson.devDependencies?.jest, undefined);
    assert.equal(packageJson.devDependencies?.["eslint-plugin-jest"], undefined);
    assert.equal(packageJson.devDependencies?.["babel-eslint"], undefined);
});

test("package exposes a local install smoke test script", async () => {
    assert.equal(
        packageJson.scripts?.["smoke:install"],
        "node ./scripts/smoke-install.mjs"
    );

    await assert.doesNotReject(
        access(new URL("../../scripts/smoke-install.mjs", import.meta.url))
    );
});
