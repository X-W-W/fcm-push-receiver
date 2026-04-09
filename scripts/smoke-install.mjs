import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const packageJsonPath = path.join(repoRoot, "package.json");
const firebaseConfigPath = path.join(repoRoot, "firebase.json");
const firebaseTemplatePath = path.join(repoRoot, "firebase.template.json");

await main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});

async function main () {
    const packageJson = await readJson(packageJsonPath);
    const firebaseConfig = await readFirebaseConfig();

    console.log("Building package...");
    run("pnpm", ["run", "build"], { "cwd": repoRoot });

    console.log("Packing tarball...");
    const tarballName = run("npm", ["pack", "--silent"], {
        "capture": true,
        "cwd": repoRoot
    }).trim();
    const tarballPath = path.join(repoRoot, tarballName);

    const tempRoot = await mkdtemp(path.join(tmpdir(), "fcm-push-receiver-smoke-"));

    try {
        console.log("Installing packed tarball into a temporary project...");
        run("npm", ["init", "-y"], { "cwd": tempRoot });
        run("npm", [
            "install",
            "--silent",
            "--no-fund",
            "--no-audit",
            tarballPath
        ], { "cwd": tempRoot });

        const probePath = path.join(tempRoot, "smoke-probe.mjs");
        await writeFile(
            probePath,
            createProbeSource(),
            "utf8"
        );

        console.log("Running installed-package smoke test...");
        const output = run("node", [probePath], {
            "capture": true,
            "cwd": tempRoot,
            "env": {
                ...process.env,
                "SMOKE_FIREBASE_CONFIG": firebaseConfigPath,
                "SMOKE_PACKAGE_NAME": packageJson.name
            }
        });
        process.stdout.write(output);
        if (!output.endsWith("\n")) {
            process.stdout.write("\n");
        }
    } finally {
        await Promise.allSettled([
            rm(tempRoot, { "recursive": true,
                "force": true }),
            unlink(tarballPath)
        ]);
    }

    console.log(
        `Smoke install completed using ${path.basename(firebaseConfigPath)} (${mask(firebaseConfig.firebase.apiKey)}).`
    );
}

async function readJson (filePath) {
    return JSON.parse(await readFile(filePath, "utf8"));
}

async function readFirebaseConfig () {
    try {
        await access(firebaseConfigPath);
    } catch {
        throw new Error(
            `Missing firebase.json. Copy ${path.basename(firebaseTemplatePath)} to ${path.basename(firebaseConfigPath)} and fill in your Firebase project values.`
        );
    }

    const config = await readJson(firebaseConfigPath);
    const missingFields = [
        !config.firebase?.apiKey && "firebase.apiKey",
        !config.firebase?.appId && "firebase.appId",
        !config.firebase?.projectId && "firebase.projectId"
    ].filter(Boolean);

    if (missingFields.length > 0) {
        throw new Error(
            `Missing required Firebase config fields: ${missingFields.join(", ")}`
        );
    }

    return config;
}

function run (command, args, options = {}) {
    const result = spawnSync(command, args, {
        "cwd": options.cwd ?? repoRoot,
        "encoding": "utf8",
        "env": options.env ?? process.env,
        "stdio": "pipe"
    });

    if (result.status !== 0) {
        const output = [result.stdout, result.stderr]
            .filter(Boolean)
            .join("")
            .trim();
        const details = output ? `\n${output}` : "";
        throw new Error(
            `Command failed: ${command} ${args.join(" ")}${details}`
        );
    }

    if (!options.capture) {
        return "";
    }

    return result.stdout;
}

function mask (value) {
    if (!value || typeof value !== "string") {
        return "<empty>";
    }

    if (value.length <= 10) {
        return `${value.slice(0, 2)}***${value.slice(-2)}`;
    }

    return `${value.slice(0, 6)}***${value.slice(-6)}`;
}

function createProbeSource () {
    return `import { readFile } from "node:fs/promises";

const config = JSON.parse(
    await readFile(process.env.SMOKE_FIREBASE_CONFIG, "utf8")
);
const { listen, register } = await import(process.env.SMOKE_PACKAGE_NAME);

function mask (value) {
    if (!value || typeof value !== "string") {
        return "<empty>";
    }

    if (value.length <= 10) {
        return \`\${value.slice(0, 2)}***\${value.slice(-2)}\`;
    }

    return \`\${value.slice(0, 6)}***\${value.slice(-6)}\`;
}

const credentials = await register(config);
credentials.persistentIds ??= [];
console.log("register_ok token=" + mask(credentials.fcm?.token));
console.log("register_ok androidId=" + mask(credentials.gcm?.androidId));

const client = await listen(credentials, () => {});

await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
        client.destroy();
        reject(new Error("listen timeout: no connect event within 12s"));
    }, 12000);

    client.once("connect", () => {
        clearTimeout(timeout);
        console.log("listen_ok connected");
        client.destroy();
        resolve();
    });

    client.once("disconnect", () => {
        clearTimeout(timeout);
        reject(new Error("listen disconnected before connect"));
    });
});
`;
}
