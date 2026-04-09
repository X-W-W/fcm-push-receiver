import { FIREBASE_CONFIG, SERVER_KEY } from "./keys.template.mjs";
import { listen, register } from "../dist/index.js";

const LARGE_BODY = "x".repeat(4096);
const NOTIFICATIONS = {
    "SIMPLE": {
        "title": "Hello world ",
        "body": "Test"
    },
    "LARGE": {
        "title": "Hello world ",
        "body": LARGE_BODY
    }
};

let credentials;
let client;

async function send (notification) {
    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
        "method": "POST",
        "headers": {
            "Authorization": `key=${SERVER_KEY}`,
            "Content-Type": "application/json"
        },
        "body": JSON.stringify({
            "to": credentials.fcm.token,
            "notification": notification
        })
    });
    const payload = await response.json();

    if (!response.ok || payload.success !== 1) {
        throw new Error(`sending of notification failed: ${JSON.stringify(payload)}`);
    }

    return payload;
}

async function receive (count) {
    const received = [];
    return new Promise(resolve => {
        const onNotification = notification => {
            received.push(notification);
            if (received.length === count) {
                resolve(received);
            }
        };
        credentials.persistentIds = [];
        void listen(credentials, onNotification).then(nextClient => {
            client = nextClient;
        });
    });
}

(async () => {
    credentials = await register(FIREBASE_CONFIG);
    await send(NOTIFICATIONS.SIMPLE);
    const notifications = await receive(1);
    console.log(notifications);
    client?.destroy();
})();
