# fcm-push-receiver

An ESM-only Node.js library that subscribes to GCM/FCM and receives Firebase Cloud Messaging notifications inside a Node process.

The original [push-receiver](https://github.com/MatthieuLemoine/push-receiver) FCM registration endpoint has been [deprecated and removed as of June 20, 2024](https://firebase.google.com/support/faq#fcm-depr-features). This package keeps the Node receiver flow updated for the current registration endpoints.

## When should I use `fcm-push-receiver`?

- I want to **receive** Firebase Cloud Messaging notifications in a Node.js process.
- I want to communicate with a backend or long-running Node worker over Firebase Cloud Messaging infrastructure.

## When should I not use `fcm-push-receiver`?

- I want to **send** push notifications. Use the official Firebase Admin SDK instead.
- My application already runs on an officially supported FCM client platform such as Android, iOS, or the Web.

## Install

```bash
npm install fcm-push-receiver
```

This package currently ships as native ESM only. Use `import`, not `require()`.

## Requirements

- Node.js 18.18 or newer with native ESM support.
- Firebase `apiKey`, `appId`, and `projectId` to register the receiver.
- A Firebase server key only if you still want to exercise the legacy local send script. The corresponding legacy FCM send endpoint was deprecated and removed on June 20, 2024, so live success is not expected there.

## Usage

```js
import { listen, register } from "fcm-push-receiver";

const config = {
  firebase: {
    apiKey: "XXxxXxX0x0x-Xxxx0-X0Xxxxx_0xxXx_XX0xXxX",
    appId: "1:000000000000:android:xxx0xxxx0000x000xxx000",
    projectId: "the-app-name"
  },
  vapidKey: ""
};

const credentials = await register(config);
const fcmToken = credentials.fcm.token;
storeCredentials(credentials);
sendTokenToBackendOrWhatever(fcmToken);

let savedCredentials = getSavedCredentials();
if (savedCredentials.persistentIds == null) {
  savedCredentials.persistentIds = getPersistentIds() ?? [];
}

await listen(savedCredentials, onNotification);

function onNotification({ notification, persistentId }) {
  if (savedCredentials.persistentIds == null) {
    savedCredentials.persistentIds = [];
  }
  if (!savedCredentials.persistentIds.includes(persistentId)) {
    savedCredentials.persistentIds.push(persistentId);
    updatePersistentIds(savedCredentials.persistentIds);
  }
  display(notification);
}
```

Note: A receiver registration is intended for a single active listener. Running multiple listener processes with the same stored credentials can cause repeated disconnect/reconnect cycles.

## Local receiver example

For local testing, the quickest path is the bundled example:

1. Copy `firebase.template.json` to `firebase.json`
2. Fill in your Firebase `apiKey`, `appId`, and `projectId`
3. Build the package
4. Run `node example/index.ts`

On the first run, the example registers a receiver, prints the full FCM token, and writes credentials to `storage.json`. Later runs reuse `storage.json` and reconnect with the same receiver credentials.

```bash
cp firebase.template.json firebase.json
pnpm run build
node example/index.ts
```

## Local scripts

Build the package first:

```bash
pnpm run build
```

Register a receiver locally:

```bash
node ./scripts/register/index.js --apiKey="<FIREBASE_API_KEY>" --appId="<FIREBASE_APP_ID>" --projectId="<FIREBASE_PROJECT_ID>"
```

Try the legacy send script locally:

```bash
node ./scripts/send/index.js --serverKey="<FIREBASE_SERVER_KEY>" --token="<FCM_TOKEN>"
```

Note: the `send` endpoint is deprecated and removed as of June 20, 2024, so the send script is kept only as a local compatibility helper.

## Testing

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run test`

The automated test suite uses Node's built-in test runner:

- unit tests: `test/unit/*.test.mjs`
- e2e tests: `test/e2e/*.test.mjs`

The manual notification flow remains in `test/manual-notification.e2e.mjs` and is intentionally not part of the default automated suite.

## Acknowledgements

- [push-receiver](https://github.com/MatthieuLemoine/push-receiver) for the original implementation.
- [Aracna FCM](https://github.com/queelag/fcm) for the updated FCM registration endpoints.
