import { v4 as uuidv4 } from "uuid";
import { installFCM, registerFCM } from "../fcm/index.js";
import { register as registerGCM } from "../gcm/index.js";
import type { ICredentials, IFirebaseConfig } from "../types.js";

async function register (config: IFirebaseConfig): Promise<ICredentials> {
    const appId = `wp:receiver.push.com#${uuidv4()}`;
    const subscription = await registerGCM(appId);
    const installation = await installFCM(config);
    const result = await registerFCM({
        ...config,
        "authToken": installation.authToken.token,
        "token": subscription.token
    });

    return {
        ...result,
        "gcm": subscription
    };
}

export default register;
