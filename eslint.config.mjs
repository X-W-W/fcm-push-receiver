// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import stylisticTs from "@stylistic/eslint-plugin-ts";

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.strict,
    tseslint.configs.stylistic,
    {
        "extends": [stylisticTs.configs["all-flat"]],
        "ignores": [
            "node_modules/",
            ".DS_Store",
            "npm-debug.log",
            "coverage",
            "*.pem",
            "storage.json",
            "web/",
            ".esm-cache",
            "dist/"
        ],
        "languageOptions": {
            "globals": {
                ...globals.node
            }
        },
        "rules": {
            "@stylistic/ts/object-curly-spacing": ["error", "always"]
        }
    }
);
