# TypeScript ESM Migration Design

**Date:** 2026-04-08
**Status:** Approved

## Goal

Complete the unfinished TypeScript migration for this Firebase Cloud Messaging receiver library and converge the package on a standard ESM-only build output. The repository should have one clear source of truth for code (`src/`) and one clear source of truth for published runtime artifacts (`dist/`).

## Current State

The project has already moved most core code into TypeScript under `src/`, but the migration is not yet complete at the package boundary.

### What is already in place

- Core library modules are written in TypeScript: `src/client.ts`, `src/parser.ts`, `src/gcm/index.ts`, `src/fcm/index.ts`, `src/register/index.ts`
- Strict TypeScript checking is enabled in `tsconfig.json`
- Declaration output is already configured
- The build script already expects `tsc` output in `dist/`

### What is still inconsistent

- The module system is mixed between NodeNext/ESM assumptions and older CommonJS habits
- Relative imports are not consistently written for NodeNext-compatible ESM output
- Runtime resource loading still depends on `__dirname`
- The package manifest still reflects an older JS/CJS publishing model
- Repo-level scripts, examples, and tests still point at source files or CommonJS entrypoints
- Some internal data shapes are still too loosely typed at runtime boundaries

## Decision

This migration will target **ESM-only output**.

The package will not attempt to preserve ad-hoc CommonJS consumption during this phase. If CJS compatibility is needed later, it should be added in a separate phase with bundler support so this migration can stay focused on consistency and correctness.

## Non-Goals

The following items are intentionally out of scope for this phase unless they directly block the migration:

- Producing dual ESM/CJS builds
- Replacing `request-promise`
- Replacing the current test framework
- Refactoring notification protocol logic beyond what type safety and ESM correctness require
- Broad product-level API redesign

## Target Architecture

### Source and build layout

- `src/` remains the only source directory for library code
- `dist/` becomes the only supported runtime and publish output
- `.d.ts` files are emitted alongside compiled JavaScript
- Required protobuf assets are copied into `dist/` as part of the build

### Package contract

The package manifest will explicitly describe the library as an ESM package and expose only the compiled entrypoints.

Expected characteristics:

- `type: "module"`
- explicit `main`, `types`, and `exports`
- `files` restricted to the published artifacts that consumers actually need
- scripts aligned with TypeScript source files instead of legacy `src/**/*.js` assumptions

### Module rules

All internal imports must be valid for NodeNext-style TypeScript compilation and emitted ESM runtime behavior.

That means:

- relative imports are written consistently with emitted JavaScript in mind
- type-only imports use `import type` where appropriate
- runtime path logic is compatible with ESM
- source files no longer assume CommonJS globals

### Runtime asset loading

The protobuf files are runtime dependencies and must continue to work after compilation. The implementation should resolve file paths relative to the module file in an ESM-safe way, not through CommonJS-only globals.

The migration must verify both of these cases:

- development-time resolution from `src/`
- compiled-time resolution from `dist/`

## Public API and Type Boundaries

The migration should preserve the current public API shape as much as possible while tightening type safety.

### Public API to preserve

- `register(config)`
- `listen(credentials, notificationCallback)`

### Type boundaries to tighten

- Firebase config shape
- registration result shape
- MCS data message shape used by `Client`
- decrypted notification payload shape
- callback argument shape passed to notification listeners
- request helper generics and error handling types where practical

The goal is not to model every protobuf structure exhaustively. The goal is to stop wide or unstructured values from leaking across module boundaries and into core control flow.

## Repo-Level Changes

### Scripts

Repository scripts should stop depending on importing raw source through old CommonJS entrypoints. They should either:

- run against compiled `dist/` output, or
- explicitly use a TS runtime when that is truly intended

For this migration, the preferred default is to point scripts at compiled output.

### Example

The example should demonstrate the intended modern usage pattern and should no longer import `../src/index.ts` directly.

### Tests

Tests do not all need to be rewritten in this phase, but they must stop depending on assumptions that conflict with the ESM-only package direction. Minimal changes are acceptable if they allow the package contract and core runtime path to be validated.

### Documentation

README and any developer-facing examples should be updated to match the real package name, config field names, and supported runtime style.

## Risks and Mitigations

### Risk: ESM path resolution breaks protobuf loading

This is the highest-risk area because the code can typecheck successfully while still failing at runtime.

**Mitigation:** update path resolution carefully and validate with a build plus a runtime smoke check that loads the protobuf definitions from compiled output.

### Risk: CommonJS-era scripts silently stop working

**Mitigation:** explicitly migrate local scripts and examples rather than assuming the package entrypoint alone is enough.

### Risk: Type tightening spreads into a large refactor

**Mitigation:** define a small set of stable interface boundaries and use targeted internal assertions only where protobuf or third-party libraries force them.

### Risk: Package metadata remains inconsistent after code compiles

**Mitigation:** treat `package.json`, build scripts, and README as first-class migration targets rather than postscript cleanup.

## Success Criteria

The migration is complete when all of the following are true:

- TypeScript compiles the library cleanly
- the generated `dist/` output is the canonical runtime artifact
- protobuf files are present and loadable from compiled output
- package metadata matches the ESM-only publishing model
- local scripts/examples no longer rely on raw source CommonJS behavior
- README usage matches the actual published package contract

## Implementation Sequence

1. Align package metadata and build scripts with the ESM-only target
2. Normalize source imports and ESM runtime path handling
3. Tighten key type boundaries without broad refactors
4. Migrate scripts, example, and minimal test entrypoints to the new package boundary
5. Update documentation and verify build/runtime behavior
