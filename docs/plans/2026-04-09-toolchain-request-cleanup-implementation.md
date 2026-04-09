# Toolchain Request Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the remaining `request`-family transitive dependencies from the lockfile by pruning unused Jest-era tooling.

**Architecture:** Use the existing Node test runner and metadata tests as the source of truth. First lock in the new expectation with a failing package metadata test, then remove unused legacy devDependencies, refresh the lockfile, and verify the `request` chain is gone.

**Tech Stack:** pnpm, Node.js test runner, package metadata assertions

---

### Task 1: Lock in package cleanup expectations

**Files:**
- Modify: `test/e2e/package-metadata.test.mjs`
- Verify: `package.json`

**Step 1: Write the failing test**

Add assertions that `jest`, `eslint-plugin-jest`, and `babel-eslint` are absent from `devDependencies`.

**Step 2: Run the focused test and confirm failure**

Run: `node --test test/e2e/package-metadata.test.mjs`
Expected: FAIL because those packages are still declared.

### Task 2: Remove unused legacy tooling and refresh lockfile

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Delete the unused devDependencies**

Remove:
- `jest`
- `eslint-plugin-jest`
- `babel-eslint`

**Step 2: Refresh dependencies**

Run: `pnpm install`
Expected: lockfile updates and the `request` family leaves the dependency graph.

### Task 3: Verify request-family cleanup end-to-end

**Files:**
- Verify: `package.json`
- Verify: `pnpm-lock.yaml`
- Verify: `test/e2e/package-metadata.test.mjs`

**Step 1: Re-run the focused metadata test**

Run: `node --test test/e2e/package-metadata.test.mjs`
Expected: PASS

**Step 2: Confirm dependency graph cleanup**

Run: `pnpm why request`
Expected: no matching dependency path

**Step 3: Run full verification**

Run: `pnpm run lint`
Expected: PASS

Run: `pnpm run typecheck`
Expected: PASS

Run: `pnpm run test`
Expected: PASS
