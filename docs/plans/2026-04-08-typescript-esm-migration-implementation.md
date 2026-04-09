# TypeScript ESM Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the unfinished TypeScript migration and publish the library as a consistent ESM-only package built from `src/` into `dist/`.

**Architecture:** Keep `src/` as the single source of truth, normalize all runtime imports and asset lookups for NodeNext/ESM, and make `dist/` the only supported runtime/publish surface. Tighten types at the library boundaries while avoiding unrelated protocol refactors.

**Tech Stack:** TypeScript, Node.js ESM, protobufjs, request-promise, pnpm

---

### Task 1: Reconfirm the current package boundary and build constraints

**Files:**
- Inspect: `package.json`
- Inspect: `tsconfig.json`
- Inspect: `scripts/build.sh`
- Inspect: `src/index.ts`
- Inspect: `src/client.ts`
- Inspect: `src/parser.ts`
- Inspect: `src/gcm/index.ts`

**Step 1: Record the current package and build settings**

Read the manifest and compiler config, then note the current entrypoints, module settings, and asset-copy behavior.

**Step 2: Re-run the baseline checks**

Run: `pnpm install`
Expected: dependencies are installed and `pnpm exec tsc --noEmit` becomes available

Run: `pnpm exec tsc --noEmit`
Expected: current migration errors are visible and can be used as the implementation baseline

**Step 3: Save the baseline findings in the working notes**

Write down which issues are caused by package metadata, import specifiers, runtime path handling, or weak types so later tasks stay scoped.

**Step 4: Commit the baseline checkpoint**

```bash
git add package.json tsconfig.json scripts/build.sh src/index.ts src/client.ts src/parser.ts src/gcm/index.ts
git commit -m "chore: capture esm migration baseline"
```

### Task 2: Normalize package metadata for an ESM-only published library

**Files:**
- Modify: `package.json`
- Modify: `README.md`

**Step 1: Write the failing contract check**

Define the expected package surface before editing:

- the package declares itself as ESM
- the package exports compiled output from `dist/`
- type declarations are discoverable
- published files are restricted to needed artifacts
- lint/typecheck scripts reference TypeScript sources correctly

**Step 2: Run a manifest sanity check before changes**

Run: `node --input-type=module -e "import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync('./package.json', 'utf8')); console.log({main:p.main, types:p.types, exports:p.exports, type:p.type, files:p.files})"`
Expected: missing or inconsistent ESM metadata is visible

**Step 3: Implement the minimal manifest changes**

Update `package.json` to:

- set `type` to `module`
- point `main` and `types` at compiled output
- add an `exports` map for the root entrypoint
- add a `files` allowlist for published artifacts
- add or fix `build`, `typecheck`, and `lint` scripts so they reflect the TS codebase

Update README package usage snippets to reflect the intended package contract.

**Step 4: Run the manifest sanity check again**

Run: `node -e "import('./package.json', { assert: { type: 'json' } }).then(({default:p}) => console.log({main:p.main, types:p.types, exports:p.exports, type:p.type, files:p.files}))"`
Expected: ESM metadata prints with the expected shape

**Step 5: Commit**

```bash
git add package.json README.md
git commit -m "feat: define esm package contract"
```

### Task 3: Make internal imports and module semantics valid for NodeNext ESM

**Files:**
- Modify: `src/index.ts`
- Modify: `src/client.ts`
- Modify: `src/parser.ts`
- Modify: `src/register/index.ts`
- Modify: `src/gcm/index.ts`
- Modify: `src/fcm/index.ts`
- Modify: `src/utils/index.ts`
- Modify: `src/utils/request.ts`
- Modify: `src/utils/decrypt.ts`
- Modify: `example/index.ts`

**Step 1: Write the failing typecheck target**

Run: `pnpm exec tsc --noEmit`
Expected: import specifier, ESM global, or module-typing errors fail the check

**Step 2: Implement the minimal import and module fixes**

Update the code so that:

- relative imports use NodeNext-compatible emitted-JS paths where needed
- type-only imports use `import type`
- example usage does not import raw TS source as a runtime contract
- no module depends on CommonJS-only assumptions accidentally

**Step 3: Re-run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: import/module-semantics errors are resolved or reduced to the remaining runtime-path and type-boundary issues

**Step 4: Commit**

```bash
git add src/index.ts src/client.ts src/parser.ts src/register/index.ts src/gcm/index.ts src/fcm/index.ts src/utils/index.ts src/utils/request.ts src/utils/decrypt.ts example/index.ts
git commit -m "refactor: normalize esm imports"
```

### Task 4: Replace CommonJS path assumptions with ESM-safe runtime asset loading

**Files:**
- Modify: `src/client.ts`
- Modify: `src/parser.ts`
- Modify: `src/gcm/index.ts`
- Verify: `scripts/build.sh`
- Verify: `src/gcm/checkin.proto`
- Verify: `src/gcm/android_checkin.proto`
- Verify: `src/mcs.proto`

**Step 1: Write the failing runtime check**

After a build, run a small script that imports the compiled modules which load protobuf definitions.

Run: `pnpm run build && node -e "import('./dist/gcm/index.js').then(async (m) => { await m.checkIn().catch(err => { console.error(err.message); process.exit(1); }); })"`
Expected: before the fix, runtime path resolution or module-loading issues are likely to appear

**Step 2: Implement minimal ESM-safe path resolution**

Update protobuf file loading to resolve paths from the current module URL or an equivalent ESM-safe mechanism that still works after compilation.

**Step 3: Rebuild and rerun the runtime check**

Run: `pnpm run build`
Expected: build succeeds and protobuf assets are copied into `dist/`

Run: `node -e "import('./dist/gcm/index.js').then(m => console.log(typeof m.checkIn))"`
Expected: prints `function`

**Step 4: Commit**

```bash
git add src/client.ts src/parser.ts src/gcm/index.ts scripts/build.sh
git commit -m "fix: load protobuf assets in esm runtime"
```

### Task 5: Tighten the core type boundaries without broad protocol rewrites

**Files:**
- Modify: `src/types.ts`
- Modify: `src/client.ts`
- Modify: `src/utils/decrypt.ts`
- Modify: `src/parser.ts`
- Modify: `src/fcm/index.ts`
- Modify: `src/gcm/index.ts`
- Modify: `src/utils/request.ts`

**Step 1: Write the failing type boundary check**

Run: `pnpm exec tsc --noEmit`
Expected: remaining weakly typed or incompatible boundaries are visible

**Step 2: Add the minimal shared interfaces needed**

Introduce only the interfaces required to represent:

- notification app data entries
- encrypted data message shape consumed by `decrypt`
- callback payload shape emitted by `Client`
- registration/install response pieces actually used by the code
- request helper error access that does not rely on unchecked casts everywhere

**Step 3: Update call sites to use the shared types**

Keep protobuf conversions localized and avoid leaking wide anonymous objects into the rest of the code.

**Step 4: Re-run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: the library typechecks cleanly or only non-core external issues remain

**Step 5: Commit**

```bash
git add src/types.ts src/client.ts src/utils/decrypt.ts src/parser.ts src/fcm/index.ts src/gcm/index.ts src/utils/request.ts
git commit -m "feat: tighten library type boundaries"
```

### Task 6: Migrate local scripts, example, and minimal test entrypoints to the compiled package surface

**Files:**
- Modify: `scripts/listen/index.js`
- Modify: `scripts/register/index.js`
- Modify: `scripts/send/index.js`
- Modify: `example/index.ts`
- Modify: `test/notification.test.js`
- Verify: `test/4kb.js`
- Verify: `test/keys.template.js`

**Step 1: Write the failing smoke checks**

Run: `node scripts/register/index.js --help`
Expected: current script assumptions about raw source imports or module format may fail under the new package direction

Run: `node scripts/listen/index.js`
Expected: entrypoint wiring issues appear clearly before the migration fix

**Step 2: Implement the minimal entrypoint fixes**

Update local scripts and the example so they consume the compiled package surface or an explicit compatible runtime path instead of depending on raw source CommonJS behavior.

Keep `scripts/send/index.js` in scope only if it needs module-format adjustments to continue working in the repo.

**Step 3: Rebuild and rerun smoke checks**

Run: `pnpm run build`
Expected: compiled artifacts are available

Run: `node scripts/register/index.js --help`
Expected: script starts without module-format failure

**Step 4: Commit**

```bash
git add scripts/listen/index.js scripts/register/index.js scripts/send/index.js example/index.ts test/notification.test.js
git commit -m "refactor: align local entrypoints with dist output"
```

### Task 7: Update documentation and verify the full migration path

**Files:**
- Modify: `README.md`
- Verify: `package.json`
- Verify: `tsconfig.json`
- Verify: `scripts/build.sh`

**Step 1: Update the usage docs**

Revise README so it matches:

- the real package name
- the actual Firebase config property names in `src/types.ts`
- the ESM-oriented usage pattern
- the current build/test scripts
- any known migration caveats for users

**Step 2: Run the final verification suite**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

Run: `pnpm run build`
Expected: PASS and `dist/` contains JS, `.d.ts`, and copied protobuf assets

Run: `node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"`
Expected: prints exported library entrypoints

**Step 3: Inspect the build output briefly**

Run: `find dist -maxdepth 3 -type f | sort`
Expected: includes compiled entrypoints, declarations, and required `.proto` assets

**Step 4: Commit**

```bash
git add README.md package.json tsconfig.json scripts/build.sh dist
git commit -m "docs: finalize typescript esm migration"
```
