import { req } from "../common";

const commonPrefix = "/api/sensors/";

const uris = ["list", "listRegistered", "register", "unregister", "edit", "data", "history"] as const;
type Uris = typeof uris[number];

export const getUri = (uri: Uris) => `${commonPrefix}${uri}`;

export const listDevices = (device_uuid: string) =>
    req.get(getUri("list")).query({
        device_uuid,
    });
