import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { resolveAssetPath } from "../../dist/utils/module-path.js";

test("resolveAssetPath resolves a sibling asset from a module URL", () => {
    const resolvedPath = resolveAssetPath(
        "file:///tmp/fcm-push-receiver/dist/gcm/index.js",
        "./checkin.proto"
    );

    assert.equal(
        resolvedPath,
        path.join("/tmp/fcm-push-receiver/dist/gcm", "checkin.proto")
    );
});

test("resolveAssetPath resolves parent-relative assets from a module URL", () => {
    const resolvedPath = resolveAssetPath(
        "file:///tmp/fcm-push-receiver/dist/client.js",
        "./mcs.proto"
    );

    assert.equal(
        resolvedPath,
        path.join("/tmp/fcm-push-receiver/dist", "mcs.proto")
    );
});
