declare module "http_ece" {
    import type { ECDH } from "node:crypto";

    export interface IEceDecryptOptions {
        "version": string;
        "authSecret": string;
        "dh": string;
        "privateKey": ECDH;
        "salt": string;
    }

    export function decrypt (buffer: Buffer, options: IEceDecryptOptions): Buffer;

    const ece: {
        "decrypt": typeof decrypt;
    };

    export default ece;
}
