import { fileURLToPath } from "node:url";

export function resolveAssetPath (moduleUrl: string, relativePath: string): string {
    return fileURLToPath(new URL(relativePath, moduleUrl));
}
