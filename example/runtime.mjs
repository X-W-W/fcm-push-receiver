export function logUsingStoredCredentials () {
    console.log("Using credentials from storage.json");
}

export function logRegisteringReceiver () {
    console.log("No storage.json found. Registering a new receiver...");
}

export function logStoredFreshCredentials () {
    console.log("Stored fresh receiver credentials in storage.json");
}

export function logReceiverReady (token) {
    console.log("FCM token:", token);
    console.log("Connecting to FCM...");
}

export function attachLifecycleLogging (client) {
    client.on("connect", () => {
        console.log("Connected to FCM");
    });
    client.on("disconnect", () => {
        console.log("Disconnected from FCM");
    });
}

export function logNotification (persistentId, notification) {
    console.log("Notification received:", persistentId);
    console.log(notification);
}
