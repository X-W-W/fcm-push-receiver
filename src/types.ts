export interface IFirebaseConfig {
    "firebase": {
        "apiKey": string;
        "authDomain"?: string;
        "projectId": string;
        "storageBucket"?: string;
        "messagingSenderId"?: string;
        "appId": string;
    };
    "vapidKey"?: string;
}

export interface ICredentialsKeys {
    "privateKey": string;
    "publicKey": string;
    "authSecret": string;
}

export interface ICredentials {
    "keys": ICredentialsKeys;
    "fcm": {
        "name": string;
        "token": string;
        "web": {
            "endpoint": string;
            "p256dh": string;
            "auth": string;
            "applicationPubKey": string;
        };
    };
    "gcm": {
        "token": string;
        "androidId": string;
        "securityToken": string;
        "appId": string;
    };
    "persistentIds"?: string[];
    "lastModified"?: number;
}

export interface IInstallFCMResponse {
    "fid": string;
    "name": string;
    "refreshToken": string;
    "authToken": {
        "token": string;
        "expiresIn": string;
    };
}

export interface IDataMessageAppDataEntry {
    "key": string;
    "value": string;
}

export interface IDataMessageStanza {
    "appData": IDataMessageAppDataEntry[];
    "rawData": Buffer;
    "persistentId": string;
}

export interface INotificationInfo {
    "title": string;
    "body": string;
    "tag"?: string;
}

export interface INotificationData<T = Record<string, unknown>> {
    "notification": INotificationInfo;
    "data": T;
    "from": string;
    "priority": string;
    "fcmMessageId": string;
    "collapse_key"?: string;
}

export interface INotificationCbArgs<T = Record<string, unknown>> {
    "notification": INotificationData<T>;
    "persistentId": string;
}

export type TNotificationCb = <T = Record<string, unknown>>(data: INotificationCbArgs<T>) => void;
