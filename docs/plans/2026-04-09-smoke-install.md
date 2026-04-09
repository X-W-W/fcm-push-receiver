# Smoke Install Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a local-only `pnpm run smoke:install` flow that builds the package, installs the packed tarball into a temporary project, reads the repo-root `firebase.json`, and verifies `register()` plus `listen()` from the installed package.

**Architecture:** Keep the orchestration in a dedicated Node script so the workflow stays readable and cross-shell friendly. Guard the local config requirements up front, use child processes for `pnpm`, `npm`, and the installed-package probe, then print masked success output so local credentials are never echoed in full.

**Tech Stack:** Node.js ESM, `node:child_process`, `node:fs/promises`, existing `pnpm`/`npm` packaging flow, Node test runner.

---

### Task 1: Add the failing metadata test

**Files:**
- Modify: `test/e2e/package-metadata.test.mjs`

**Step 1: Write the failing test**

Add a test that reads `package.json`, asserts `scripts["smoke:install"]` exists, and asserts it points at a concrete runner file under `scripts/`.

**Step 2: Run test to verify it fails**

Run: `node --test test/e2e/package-metadata.test.mjs`
Expected: FAIL because `smoke:install` is not defined yet.

**Step 3: Write minimal implementation**

Do not change the test yet beyond the one new expectation.

**Step 4: Run test to verify it still fails for the missing script**

Run: `node --test test/e2e/package-metadata.test.mjs`
Expected: FAIL with a missing `smoke:install` expectation.

**Step 5: Commit**

```bash
git add test/e2e/package-metadata.test.mjs
git commit -m "test: cover smoke install package script"
```

### Task 2: Implement the smoke runner

**Files:**
- Create: `scripts/smoke-install.mjs`

**Step 1: Write the failing test**

Reuse the failing metadata test from Task 1 as the active red bar.

**Step 2: Run test to verify it fails**

Run: `node --test test/e2e/package-metadata.test.mjs`
Expected: FAIL because the script file and package hook do not exist.

**Step 3: Write minimal implementation**

Create a Node ESM script that:
- resolves the repo root from `import.meta.url`
- validates `firebase.json` exists and includes `firebase.apiKey`, `firebase.appId`, and `firebase.projectId`
- runs `pnpm run build`
- runs `npm pack --silent`
- creates a temp directory, `npm init -y`, and installs the tarball
- writes a small probe module in the temp project that imports `fcm-push-receiver`, reads the repo-root `firebase.json`, runs `register()`, then waits for a `connect` event from `listen()` with a timeout
- masks token-like values in the final output
- always removes the temp directory and tarball in a `finally` block

**Step 4: Run focused verification**

Run: `node --check scripts/smoke-install.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/smoke-install.mjs
git commit -m "feat: add local install smoke runner"
```

### Task 3: Wire package metadata

**Files:**
- Modify: `package.json`
- Test: `test/e2e/package-metadata.test.mjs`

**Step 1: Write the minimal implementation**

Add `"smoke:install": "node ./scripts/smoke-install.mjs"` to the scripts block.

**Step 2: Run the focused test to verify green**

Run: `node --test test/e2e/package-metadata.test.mjs`
Expected: PASS

**Step 3: Refactor if needed**

Keep the script name short and consistent with existing command naming.

**Step 4: Commit**

```bash
git add package.json test/e2e/package-metadata.test.mjs scripts/smoke-install.mjs
git commit -m "feat: expose smoke install verification"
```

### Task 4: Verify end to end

**Files:**
- Verify: `scripts/smoke-install.mjs`
- Verify: `package.json`
- Verify: `test/e2e/package-metadata.test.mjs`

**Step 1: Run focused tests**

Run: `node --test test/e2e/package-metadata.test.mjs`
Expected: PASS

**Step 2: Run the real smoke flow**

Run: `pnpm run smoke:install`
Expected: PASS with masked `register_ok` output and `listen_ok connected`.

**Step 3: Run the existing relevant e2e coverage**

Run: `pnpm run test:e2e`
Expected: PASS

**Step 4: Commit**

```bash
git add docs/plans/2026-04-09-smoke-install.md package.json scripts/smoke-install.mjs test/e2e/package-metadata.test.mjs
git commit -m "feat: add local install smoke test"
```
