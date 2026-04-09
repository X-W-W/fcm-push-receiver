function getArgValue (name) {
    const argv = process.argv.slice(2);
    const prefix = `--${name}=`;
    const inline = argv.find(argument => argument.startsWith(prefix));

    if (inline) {
        return inline.slice(prefix.length);
    }

    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
}

const serverKey = getArgValue("serverKey");
const token = getArgValue("token");

if (!serverKey) {
    console.error("Missing serverKey argument");
} else if (!token) {
    console.error("Missing token argument");
} else {
    try {
        const response = await fetch("https://fcm.googleapis.com/fcm/send", {
            "method": "POST",
            "headers": {
                "Authorization": `key=${serverKey}`,
                "Content-Type": "application/json"
            },
            "body": JSON.stringify({
                "to": token,
                "notification": {
                    "title": "Hello world",
                    "body": "Test"
                }
            })
        });
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(`Send request failed with ${response.status}: ${JSON.stringify(payload)}`);
        }

        console.log(payload);
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
    }
}
