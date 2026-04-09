# Toolchain Request Cleanup Design

**Date:** 2026-04-09
**Status:** Approved

## Goal

Remove remaining `request`-family packages from `pnpm-lock.yaml` by cleaning up unused legacy tooling that still pulls them in transitively.

## Findings

`pnpm why request` shows the remaining chain is:

- `jest@22.4.4`
- `jest-environment-jsdom@22.4.3`
- `jsdom@11.12.0`
- `request-promise-native@1.0.9`
- `request@2.88.2`

The repo no longer executes Jest-based tests. The active test stack is Node's built-in test runner via `node --test`.

## Options

### Option A: Remove unused legacy Jest-era tooling

Delete `jest`, `eslint-plugin-jest`, and `babel-eslint` from `devDependencies`, refresh the lockfile, and keep the current Node test runner flow.

**Pros**
- removes the deprecated transitive request stack at the source
- simplifies the toolchain to what the repo actually uses
- lowest migration risk because no active workflow depends on Jest now

**Cons**
- lockfile diff can be large
- if there is undocumented local Jest usage, it will disappear

### Option B: Upgrade Jest to a modern version

Replace the old Jest stack with a maintained version.

**Pros**
- preserves optional Jest usage

**Cons**
- more churn than needed
- still keeps an otherwise unused parallel test framework in the repo

### Option C: Leave toolchain as-is

Accept that lockfile scans will continue to show deprecated transitive packages.

**Pros**
- no work

**Cons**
- fails the cleanup goal

## Decision

Choose Option A.

## Testing Strategy

- extend package metadata tests to assert legacy Jest-era toolchain packages are no longer declared
- run the focused metadata test first to confirm failure
- update `package.json` and `pnpm-lock.yaml`
- rerun `pnpm why request`
- rerun `pnpm run lint`, `pnpm run typecheck`, and `pnpm run test`
