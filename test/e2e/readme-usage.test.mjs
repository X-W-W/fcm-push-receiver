import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("README documents the local receiver example flow", async () => {
    const readme = await readFile(
        new URL("../../README.md", import.meta.url),
        "utf8"
    );

    assert.match(readme, /Local receiver example/i);
    assert.match(readme, /firebase\.template\.json/i);
    assert.match(readme, /firebase\.json/i);
    assert.match(readme, /storage\.json/i);
    assert.match(readme, /node example\/index\.ts/i);
    assert.match(readme, /smoke:install/i);
    assert.match(readme, /npm pack/i);
    assert.match(readme, /single active listener/i);
});
