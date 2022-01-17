import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import { Router } from "express";
import { Device as DeviceApi } from "../../../api";
import { Device } from "../../../entities/Device";
import { Dispatcher } from "../../../dispatcher";
import { helper } from "../../../router";

export const deviceInfoRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = Router();

    router.get("/", helper.verifyReq(infoReq), helper.getDevice(orm), async (req, res) => {
        let device: Device = res.locals.device;
        try {
            let data = await DeviceApi.DeviceInfo.fetch({
                auth_key: device.auth_key,
                ip: device.ip,
            });
            return res.json({
                ...data,
            });
        } catch (err) {
            return helper.error(503, res, "could not fetch device info");
        }
    });

    return router;
};

const infoReq = {
    device_uuid: "string",
};
