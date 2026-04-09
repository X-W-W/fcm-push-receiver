# Native Fetch Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the deprecated request/request-promise HTTP stack with Node's native fetch while preserving the receiver library's existing behavior.

**Architecture:** Convert `src/utils/request.ts` into a thin fetch wrapper that supports the current JSON, form, and binary call patterns, then migrate all remaining request-promise call sites to either that helper or direct fetch in repo-local scripts. Keep the public receiver API unchanged.

**Tech Stack:** TypeScript, Node.js native fetch, protobufjs, pnpm

---

### Task 1: Lock in helper behavior with failing tests

**Files:**
- Create: `test/unit/request.test.mjs`
- Verify: `src/utils/request.ts`

**Step 1: Write the failing tests**

Add tests that cover:

- JSON request + JSON response
- form-urlencoded request + text response
- binary response parsing
- retry after a failed fetch attempt
- non-2xx responses becoming errors

**Step 2: Run the focused tests and confirm failure**

Run: `node --test test/unit/request.test.mjs`
Expected: FAIL because the current helper still depends on `request-promise`

**Step 3: Commit**

```bash
git add test/unit/request.test.mjs
```

### Task 2: Implement the fetch-based request helper

**Files:**
- Modify: `src/utils/request.ts`
- Modify: `src/types.ts` (only if shared HTTP types help keep the helper clean)

**Step 1: Implement the minimal helper**

Support the existing call patterns used by the library:

- `json: true` for JSON body + JSON response
- `form` for URL-encoded request bodies
- `encoding: null` for Buffer responses
- retries with the existing bounded timeout behavior
- non-2xx responses throwing useful errors

**Step 2: Run the focused tests**

Run: `node --test test/unit/request.test.mjs`
Expected: PASS

**Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS or only downstream call-site fixes remain

### Task 3: Migrate library HTTP call sites

**Files:**
- Modify: `src/fcm/index.ts`
- Modify: `src/gcm/index.ts`

**Step 1: Update FCM and GCM modules to use the new helper**

Remove direct `request-promise` imports and adapt the call sites to the new helper semantics.

**Step 2: Add/extend tests if behavior changed**

If needed, add minimal tests for any helper behavior not fully covered by Task 1.

**Step 3: Re-run verification**

Run: `pnpm run typecheck`
Expected: PASS

Run: `pnpm run test:unit`
Expected: PASS

### Task 4: Migrate scripts and manual test tooling

**Files:**
- Modify: `scripts/send/index.js`
- Modify: `test/manual-notification.e2e.mjs`
- Modify: `package.json`

**Step 1: Replace request-promise in repo-local tools**

Use native `fetch` directly in the send script and manual network test.

**Step 2: Remove deprecated dependencies**

Delete `request`, `request-promise`, and `@types/request-promise` from `package.json`.

**Step 3: Run smoke checks**

Run: `node ./scripts/send/index.js`
Expected: prints the missing argument error without import/runtime failures

Run: `pnpm install`
Expected: lockfile updates cleanly

### Task 5: Re-check and fix example portability

**Files:**
- Modify: `example/index.ts` if needed

**Step 1: Inspect the current example runtime assumptions**

Check whether the current JSON import syntax is appropriate for the declared Node engine floor.

**Step 2: Make the smallest safe fix**

If needed, replace fragile runtime syntax with a filesystem-based config load.

**Step 3: Verify**

Run: `pnpm run typecheck`
Expected: PASS

### Task 6: Final verification

**Files:**
- Verify: `package.json`
- Verify: `src/utils/request.ts`
- Verify: `src/fcm/index.ts`
- Verify: `src/gcm/index.ts`
- Verify: `scripts/send/index.js`
- Verify: `example/index.ts`

**Step 1: Run lint**

Run: `pnpm run lint`
Expected: PASS

**Step 2: Run full test suite**

Run: `pnpm run test`
Expected: PASS

**Step 3: Confirm dependency cleanup**

Run: `rg -n "request-promise|from \"request\"|from \"request-promise\"" . --glob '!node_modules/**' --glob '!dist/**'`
Expected: only docs/plans or intentionally retained historical references remain
