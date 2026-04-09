# Node 16 Runtime Fetch Compatibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the published library run on Node 16 and Electron runtimes without a global `fetch`, while preserving the existing request helper behavior.

**Architecture:** Add a memoized internal fetch resolver that prefers `globalThis.fetch` and falls back to dynamically importing `node-fetch`, then route the existing request helper through that resolver. Update package metadata and README so the published runtime floor matches the code.

**Tech Stack:** TypeScript, Node.js ESM, dynamic `import()`, `node-fetch`, pnpm, Node test runner

---

### Task 1: Lock in the compatibility behavior with focused tests

**Files:**
- Create: `test/unit/fetch-runtime.test.mjs`
- Verify: `src/utils/request.ts`
- Verify: `test/unit/request.test.mjs`

**Step 1: Write the failing tests**

Create `test/unit/fetch-runtime.test.mjs` with coverage for:

```js
import test from "node:test";
import assert from "node:assert/strict";

test("resolveFetch prefers globalThis.fetch when present", async () => {
    const nativeFetch = async () => new Response("native");
    globalThis.fetch = nativeFetch;

    const { resolveFetch } = await import("../../dist/utils/fetch.js");
    const resolvedFetch = await resolveFetch(async () => {
        throw new Error("fallback loader should not run");
    });

    assert.equal(resolvedFetch, nativeFetch);
});

test("resolveFetch falls back to the loader when globalThis.fetch is absent", async () => {
    delete globalThis.fetch;

    const fallbackFetch = async () => new Response("fallback");
    const { resolveFetch } = await import("../../dist/utils/fetch.js");
    const resolvedFetch = await resolveFetch(async () => ({ "default": fallbackFetch }));

    assert.equal(resolvedFetch, fallbackFetch);
});
```

Add one more test that calls `resolveFetch()` twice with `globalThis.fetch` removed and asserts the fallback loader runs only once.

**Step 2: Run the focused test and confirm failure**

Run: `pnpm run build && node --test test/unit/fetch-runtime.test.mjs`
Expected: FAIL because `dist/utils/fetch.js` does not exist yet

**Step 3: Commit**

```bash
git add test/unit/fetch-runtime.test.mjs
git commit -m "test: cover Node 16 fetch fallback"
```

### Task 2: Implement the internal fetch resolver

**Files:**
- Create: `src/utils/fetch.ts`

**Step 1: Write the minimal resolver**

Create `src/utils/fetch.ts` with a memoized loader:

```ts
type TFetchLike = typeof fetch;

type TFetchModule = {
    default: TFetchLike;
};

type TFetchLoader = () => Promise<TFetchModule>;

let fetchPromise: Promise<TFetchLike> | null = null;

async function defaultFetchLoader (): Promise<TFetchModule> {
    return await import("node-fetch") as TFetchModule;
}

export async function resolveFetch (loader: TFetchLoader = defaultFetchLoader): Promise<TFetchLike> {
    if (typeof globalThis.fetch === "function") {
        return globalThis.fetch.bind(globalThis) as TFetchLike;
    }

    if (!fetchPromise) {
        fetchPromise = loader().then(module => module.default);
    }

    return fetchPromise;
}
```

If TypeScript complains about the imported type shape, keep the types local and minimal rather than widening the public API.

**Step 2: Build and run the focused tests**

Run: `pnpm run build && node --test test/unit/fetch-runtime.test.mjs`
Expected: PASS

**Step 3: Commit**

```bash
git add src/utils/fetch.ts test/unit/fetch-runtime.test.mjs
git commit -m "feat: add fetch compatibility resolver"
```

### Task 3: Route the request helper through the resolver

**Files:**
- Modify: `src/utils/request.ts`
- Verify: `test/unit/request.test.mjs`

**Step 1: Replace the direct `fetch` call**

Update `src/utils/request.ts` so `requestOnce()` uses the resolver:

```ts
import { resolveFetch } from "./fetch.js";

async function requestOnce<T> (options: IRequestOptions): Promise<T> {
    const headers = options.headers ? { ...options.headers } : {};
    const fetchImpl = await resolveFetch();
    const response = await fetchImpl(options.url, {
        method: options.method ?? "GET",
        headers,
        body: getRequestBody(options, headers)
    });

    // keep the rest of the response parsing and error handling unchanged
}
```

Do not change the retry policy, body-shaping logic, or error text unless a test proves the old behavior is broken.

**Step 2: Run request-helper verification**

Run: `pnpm run build && node --test test/unit/request.test.mjs test/unit/fetch-runtime.test.mjs`
Expected: PASS

**Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/utils/request.ts src/utils/fetch.ts test/unit/request.test.mjs test/unit/fetch-runtime.test.mjs
git commit -m "feat: support runtimes without native fetch"
```

### Task 4: Align published metadata and documentation

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `README.md`
- Modify: `test/e2e/package-metadata.test.mjs`

**Step 1: Add the runtime dependency and lower the declared engine floor**

Update `package.json` so it:

```json
{
  "dependencies": {
    "node-fetch": "^3.3.2"
  },
  "engines": {
    "node": ">=16.20.0"
  }
}
```

Keep the rest of the dependency graph untouched unless `pnpm install` requires lockfile normalization.

**Step 2: Update docs to separate runtime support from maintainer guidance**

Revise the README requirements section so it says, in substance:

- published library runtime: Node 16.20+ or newer
- maintainers and CI verification: Node 18+ recommended

Update `test/e2e/package-metadata.test.mjs` only as needed so it checks for a valid lower-bounded engine string instead of hard-coding the old Node 18 floor.

**Step 3: Refresh the lockfile and run metadata checks**

Run: `pnpm install`
Expected: `pnpm-lock.yaml` adds `node-fetch` cleanly

Run: `node --test test/e2e/package-metadata.test.mjs`
Expected: PASS

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml README.md test/e2e/package-metadata.test.mjs
git commit -m "docs: document Node 16 runtime support"
```

### Task 5: Final verification

**Files:**
- Verify: `src/utils/fetch.ts`
- Verify: `src/utils/request.ts`
- Verify: `package.json`
- Verify: `README.md`
- Verify: `test/unit/fetch-runtime.test.mjs`
- Verify: `test/unit/request.test.mjs`
- Verify: `test/e2e/package-metadata.test.mjs`

**Step 1: Run lint**

Run: `pnpm run lint`
Expected: PASS

**Step 2: Run build plus unit and e2e tests**

Run: `pnpm run test`
Expected: PASS

**Step 3: Confirm the fallback dependency is the only new runtime HTTP piece**

Run: `rg -n "node-fetch|globalThis.fetch|resolveFetch" src test README.md package.json`
Expected: matches only the intended compatibility changes

**Step 4: Commit**

```bash
git add src/utils/fetch.ts src/utils/request.ts package.json pnpm-lock.yaml README.md test/unit/fetch-runtime.test.mjs test/unit/request.test.mjs test/e2e/package-metadata.test.mjs
git commit -m "feat: add Node 16 fetch compatibility"
```
