# Node 16 Runtime Fetch Compatibility Design

**Date:** 2026-04-10
**Status:** Approved

## Goal

Allow published `fcm-push-receiver` builds to run in Electron and Node 16 environments that do not provide a global `fetch`, without changing the library's public API or request behavior.

## Scope

This compatibility pass covers:

- published library runtime HTTP behavior in `src/utils/request.ts`
- a small internal compatibility layer for resolving a usable `fetch` implementation
- package metadata and docs so the advertised runtime floor matches the shipped behavior
- targeted tests that prove the library prefers native `fetch` when available and falls back to `node-fetch` when it is not

## Non-Goals

- broad contributor-tooling support for running the whole repo on Node 16
- changing the behavior of `register()` or `listen()`
- replacing the retry/backoff/error behavior already implemented in the request helper
- introducing a new public configuration option for HTTP clients

## Decision

Use a small internal fetch resolver that:

1. uses `globalThis.fetch` when the runtime already provides one
2. dynamically imports `node-fetch` when `globalThis.fetch` is missing

This keeps Node 18+ on the native implementation while making the published library usable in Electron and Node 16 runtimes.

## Architecture

### Internal fetch resolver

Create `src/utils/fetch.ts` as the only place that decides where `fetch` comes from.

Responsibilities:

- detect whether `globalThis.fetch` exists
- return the native implementation immediately when available
- lazily load `node-fetch` otherwise
- memoize the resolved implementation so the fallback import happens at most once per process

Keeping this logic in one file prevents `src/utils/request.ts` from accumulating environment-specific branching and makes the fallback path easy to test directly.

### Request helper integration

`src/utils/request.ts` should stop calling `fetch(...)` directly and instead await the resolver from `src/utils/fetch.ts`.

No request semantics change:

- `json: true` still serializes JSON request bodies and parses JSON responses
- `form` still produces `application/x-www-form-urlencoded`
- `encoding: null` still returns `Buffer`
- 5xx responses and transport failures remain retryable
- 4xx responses still fail without retries

### Package metadata and docs

To make the runtime story honest:

- add `node-fetch` as a runtime dependency in `package.json`
- lower `engines.node` to the minimum Node 16 patch version we are willing to support; `>=16.20.0` is the recommended floor
- update the README requirements section to distinguish published-library runtime support from the repo's preferred maintainer environment

The README should make it clear that consumers can run the package on Node 16.20+ or newer, while contributors are still encouraged to use Node 18+ for the repo's tooling and verification workflows.

## Testing Strategy

### New tests

Add a focused unit test file for the resolver:

- native `fetch` is preferred when present
- fallback loader is used when native `fetch` is absent
- resolved implementation is memoized after the first fallback load

### Existing tests to keep

Retain the current request-helper coverage in `test/unit/request.test.mjs` so the migration does not accidentally change request semantics while adding compatibility.

### Verification

- `pnpm run build`
- `node --test test/unit/fetch-runtime.test.mjs test/unit/request.test.mjs`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run test`

All verification can continue to run in the current Node 18 maintainer environment; the new focused tests provide the Node 16 compatibility evidence without requiring the whole repo to execute under Node 16.

## Success Criteria

This work is complete when:

- published library code no longer requires a native global `fetch`
- Node 18+ still uses the built-in implementation
- Node 16 runtimes can transparently fall back to `node-fetch`
- package metadata and README reflect the supported runtime floor
- existing request-helper behavior remains unchanged according to tests
