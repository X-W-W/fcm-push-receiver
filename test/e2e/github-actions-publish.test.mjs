import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("publish workflow is manually triggered and uses NPM_TOKEN", async () => {
    const workflowSource = await readFile(
        new URL("../../.github/workflows/publish.yml", import.meta.url),
        "utf8"
    );

    assert.match(workflowSource, /workflow_dispatch:/);
    assert.match(workflowSource, /github\.ref == 'refs\/heads\/master'/);
    assert.match(workflowSource, /pnpm run build/);
    assert.match(workflowSource, /pnpm run typecheck/);
    assert.match(workflowSource, /pnpm run lint/);
    assert.match(workflowSource, /pnpm run test/);
    assert.match(workflowSource, /npm publish/);
    assert.match(workflowSource, /NPM_TOKEN/);
});
