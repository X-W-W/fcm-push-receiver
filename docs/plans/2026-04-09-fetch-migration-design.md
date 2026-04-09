# Native Fetch Migration Design

**Date:** 2026-04-09
**Status:** Approved

## Goal

Replace the deprecated `request` / `request-promise` dependency chain with Node's built-in `fetch` while preserving the current runtime behavior of the FCM/GCM receiver library.

## Scope

This migration covers:

- library HTTP calls in `src/utils/request.ts`, `src/gcm/index.ts`, and `src/fcm/index.ts`
- repo-local send/manual-integration scripts that still import `request-promise`
- package metadata cleanup for deprecated HTTP dependencies
- a quick re-check of `example/index.ts` so it does not regress under the updated runtime assumptions

## Non-Goals

- changing the public API of `register()` or `listen()`
- redesigning retry policy beyond preserving existing behavior
- moving to a third-party HTTP client such as `undici`
- expanding automated tests to live Firebase network coverage

## Decision

Use Node's native `fetch` and implement a thin internal request helper in `src/utils/request.ts`.

The helper should preserve the small set of behaviors the codebase actually depends on:

- JSON request/response handling
- `application/x-www-form-urlencoded` request bodies
- binary response handling for protobuf check-in
- retry behavior with bounded backoff
- non-2xx responses surfacing as errors

## Architecture

### Internal HTTP helper

`src/utils/request.ts` will become a fetch-based wrapper with a narrow typed options object. It should accept the existing call patterns used by the library so the migration remains localized:

- `body` + `json: true` for JSON requests
- `form` for URL-encoded requests
- `encoding: null` for binary responses
- `headers`, `method`, and `url`

The wrapper should translate those options into a `fetch()` call, parse the response into `text`, `json`, or `Buffer`, and retry failures in the same spirit as the current helper.

### Library call sites

- `src/gcm/index.ts` keeps using the shared helper for protobuf check-in and `register3`
- `src/fcm/index.ts` stops importing `request-promise` directly and uses the shared helper
- `scripts/send/index.js` and `test/manual-notification.e2e.mjs` switch to direct native `fetch` because they are small repo-local tools

### Example follow-up

`example/index.ts` should be checked for runtime portability after this phase. If the current JSON import style is too new for the declared Node engine floor, prefer a filesystem-based config load instead of fragile syntax.

## Testing Strategy

### Automated tests to add

- request helper JSON request/response behavior
- request helper form encoding behavior
- request helper binary response behavior
- request helper retry behavior
- request helper non-2xx error handling

### Verification

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- inspect `package.json` to ensure deprecated request dependencies are removed

## Success Criteria

This phase is complete when:

- `request`, `request-promise`, and `@types/request-promise` are no longer required
- all library HTTP traffic uses native `fetch` through the internal helper
- repo-local send/manual scripts no longer import `request-promise`
- `example/index.ts` has been checked and fixed if needed
- lint, typecheck, and automated tests all pass
