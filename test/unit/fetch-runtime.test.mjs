import test from "node:test";
import assert from "node:assert/strict";

let moduleLoadCounter = 0;

async function loadFetchModule () {
    moduleLoadCounter += 1;
    return await import(`../../dist/utils/fetch.js?test=${moduleLoadCounter}`);
}

test("resolveFetch prefers native global fetch", async () => {
    const nativeFetch = async () => new Response("native");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = nativeFetch;

    const module = await loadFetchModule();
    const resolved = await module.resolveFetch(async () => {
        throw new Error("fallback loader should not run when native fetch exists");
    });

    assert.equal(resolved, nativeFetch);
    globalThis.fetch = originalFetch;
});

test("resolveFetch falls back to loader when global fetch is missing", async () => {
    const originalFetch = globalThis.fetch;
    delete globalThis.fetch;

    const fallbackFetch = async () => new Response("fallback");
    const module = await loadFetchModule();
    const resolved = await module.resolveFetch(async () => ({ "default": fallbackFetch }));

    assert.equal(resolved, fallbackFetch);
    globalThis.fetch = originalFetch;
});

test("resolveFetch memoizes the fallback loader result", async () => {
    const originalFetch = globalThis.fetch;
    delete globalThis.fetch;

    const fallbackFetch = async () => new Response("fallback");
    let loaderRuns = 0;
    const loader = async () => {
        loaderRuns += 1;
        return { "default": fallbackFetch };
    };

    const module = await loadFetchModule();
    const first = await module.resolveFetch(loader);
    const second = await module.resolveFetch(loader);

    assert.equal(first, fallbackFetch);
    assert.equal(second, fallbackFetch);
    assert.equal(loaderRuns, 1);
    globalThis.fetch = originalFetch;
});
