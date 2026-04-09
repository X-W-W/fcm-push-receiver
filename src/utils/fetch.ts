type TFetchLike = typeof fetch;

interface IFetchModule {
    "default": TFetchLike;
}

type TFetchLoader = () => Promise<IFetchModule>;

let fetchPromise: Promise<TFetchLike> | null = null;

async function defaultFetchLoader (): Promise<IFetchModule> {
    const moduleName = "node-fetch";
    return await import(moduleName) as IFetchModule;
}

export async function resolveFetch (loader: TFetchLoader = defaultFetchLoader): Promise<TFetchLike> {
    if (typeof globalThis.fetch === "function") {
        return globalThis.fetch;
    }

    if (!fetchPromise) {
        fetchPromise = loader().then(module => module.default);
    }

    return fetchPromise;
}
