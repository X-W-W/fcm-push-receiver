import { waitFor } from "./timeout.js";

const MAX_RETRY_TIMEOUT = 15;
const RETRY_STEP = 5;
const MAX_RETRY_COUNT = 3;

type TJsonBody = Record<string, unknown>;
type TBinaryBody = ArrayBuffer | ArrayBufferView;
type TRequestBody = BodyInit | TBinaryBody | TJsonBody;

export interface IRequestOptions {
    "url": string;
    "method"?: string;
    "headers"?: Record<string, string>;
    "body"?: TRequestBody;
    "json"?: boolean;
    "form"?: Record<string, string>;
    "encoding"?: null;
}

export default function requestWithRetry<T = unknown> (options: IRequestOptions): Promise<T> {
    return retry(0, options);
}

class RequestError extends Error {
    status?: number;

    statusText?: string;

    responseText?: string;

    constructor (
        message: string,
        details: {
            "status"?: number;
            "statusText"?: string;
            "responseText"?: string;
        } = {}
    ) {
        super(message);
        this.name = "RequestError";
        this.status = details.status;
        this.statusText = details.statusText;
        this.responseText = details.responseText;
    }
}

async function retry<T> (retryCount: number, options: IRequestOptions): Promise<T> {
    try {
        return await requestOnce<T>(options);
    } catch (error) {
        if (!shouldRetry(error) || retryCount >= MAX_RETRY_COUNT) {
            throw error;
        }

        const message = error instanceof Error ? error.message : "Unknown request error";
        const timeout = Math.min(retryCount * RETRY_STEP, MAX_RETRY_TIMEOUT);
        console.error(`Request failed : ${message}`);
        console.error(`Retrying in ${timeout} seconds`);
        await waitFor(timeout * 1000);
        return retry<T>(retryCount + 1, options);
    }
}

async function requestOnce<T> (options: IRequestOptions): Promise<T> {
    const headers = options.headers ? { ...options.headers } : {};
    const response = await fetch(options.url, {
        "method": options.method ?? "GET",
        "headers": headers,
        "body": getRequestBody(options, headers)
    });

    const responseText = options.encoding === null
        ? undefined
        : await response.clone().text();

    if (!response.ok) {
        throw new RequestError(
            buildErrorMessage(options, response.status, response.statusText, responseText),
            {
                "status": response.status,
                "statusText": response.statusText,
                "responseText": responseText
            }
        );
    }

    if (options.encoding === null) {
        return Buffer.from(await response.arrayBuffer()) as T;
    }

    if (options.json) {
        if (!responseText) {
            return null as T;
        }

        return JSON.parse(responseText) as T;
    }

    if (responseText === undefined) {
        return "" as T;
    }

    return responseText as T;
}

function getRequestBody (options: IRequestOptions, headers: Record<string, string>): BodyInit | undefined {
    if (options.form) {
        setHeaderIfMissing(headers, "Content-Type", "application/x-www-form-urlencoded");
        return new URLSearchParams(options.form).toString();
    }

    if (options.json && isJsonObject(options.body)) {
        setHeaderIfMissing(headers, "Content-Type", "application/json");
        return JSON.stringify(options.body);
    }

    return options.body as BodyInit | undefined;
}

function isJsonObject (value: IRequestOptions["body"]): value is TJsonBody {
    return Boolean(value)
        && typeof value === "object"
        && !Buffer.isBuffer(value)
        && !(value instanceof ArrayBuffer)
        && !ArrayBuffer.isView(value);
}

function setHeaderIfMissing (headers: Record<string, string>, key: string, value: string) {
    const existingKey = Object.keys(headers).find(header => header.toLowerCase() === key.toLowerCase());

    if (!existingKey) {
        headers[key] = value;
    }
}

function shouldRetry (error: unknown): boolean {
    if (!(error instanceof RequestError)) {
        return true;
    }

    if (!error.status) {
        return true;
    }

    return error.status >= 500;
}

function buildErrorMessage (
    options: IRequestOptions,
    status: number,
    statusText: string,
    responseText?: string
): string {
    const suffix = responseText ? `: ${responseText}` : "";
    return `Request failed with ${status} ${statusText} for ${options.method ?? "GET"} ${options.url}${suffix}`;
}
