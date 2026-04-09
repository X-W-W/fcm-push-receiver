import { register } from "../../dist/index.js";

function getArgValue (...names) {
    const argv = process.argv.slice(2);

    for (const name of names) {
        const prefix = `--${name}=`;
        const inline = argv.find(argument => argument.startsWith(prefix));
        if (inline) {
            return inline.slice(prefix.length);
        }

        const index = argv.indexOf(`--${name}`);
        if (index >= 0 && argv[index + 1]) {
            return argv[index + 1];
        }
    }

    return undefined;
}

const apiKey = getArgValue("apiKey");
const appId = getArgValue("appId", "appID");
const projectId = getArgValue("projectId", "projectID");
const vapidKey = getArgValue("vapidKey") ?? "";

if (!apiKey) {
    console.error("Missing apiKey");
} else if (!appId) {
    console.error("Missing appId");
} else if (!projectId) {
    console.error("Missing projectId");
} else {
    const config = {
        "firebase": {
            apiKey,
            appId,
            projectId
        },
        vapidKey
    };

    try {
        await register(config);
        console.log("Successfully registered");
    } catch (error) {
        console.error("Error during registration");
        console.error(error);
    }
}
