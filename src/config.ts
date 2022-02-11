import { env } from "process";

export const Config = {
    Redis: {
        host: env.REDIS_HOST ?? "localhost",
        port: +(env.REDIS_PORT ?? 6379),
        dbNumber: +(env.REDIS_DB_NUMBER ?? 0),
    },
    Dispatcher: {
        Worker: {
            // how many times will worker try to fetch data from device
            // before acknowledging it as offline
            pollRetryCount: +(env.WORKER_POLL_RETRY_COUNT ?? 3),
        },
    },
    Node: {
        // what ip address should nodes use to communicate back to server
        callbackHost: env.NODE_CALLBACK_HOST ?? "192.168.1.48",
        callbackPort: +(env.NODE_CALLBACK_PORT ?? 3001),
    },
} as const;
