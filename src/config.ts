export const Config = {
    Dispatcher: {
        Worker: {
            // how many times will worker try to fetch data from device
            // before acknowledging it as offline
            pollRetryCount: 3,
        },
    },
    Node: {
        // what ip address should nodes use to communicate back to server
        callbackHost: "192.168.1.48",
        callbackPort: 3001,
    },
} as const;
