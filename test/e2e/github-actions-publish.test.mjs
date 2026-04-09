import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("publish workflow is manually triggered and uses trusted publishing", async () => {
    const workflowSource = await readFile(
        new URL("../../.github/workflows/publish.yml", import.meta.url),
        "utf8"
    );

    assert.match(workflowSource, /workflow_dispatch:/);
    assert.match(workflowSource, /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:\s*true/);
    assert.match(workflowSource, /actions\/checkout@v5/);
    assert.match(workflowSource, /actions\/setup-node@v5/);
    assert.match(workflowSource, /github\.ref == 'refs\/heads\/master'/);
    assert.match(workflowSource, /id-token:\s*write/);
    assert.match(workflowSource, /pnpm run build/);
    assert.match(workflowSource, /pnpm run typecheck/);
    assert.match(workflowSource, /pnpm run lint/);
    assert.match(workflowSource, /pnpm run test/);
    assert.match(workflowSource, /npm publish/);
    assert.doesNotMatch(workflowSource, /NPM_TOKEN/);
});

test("package metadata declares an explicit pnpm version", async () => {
    const packageSource = await readFile(
        new URL("../../package.json", import.meta.url),
        "utf8"
    );
    const pkg = JSON.parse(packageSource);

    assert.match(pkg.packageManager ?? "", /^pnpm@\d+\.\d+\.\d+$/);
});
