import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import { Request, Response, Router } from "express";
import { Device as DeviceApi } from "../../../api";
import { Device } from "../../../entities/Device";
import { Dispatcher } from "../../../dispatcher";
import { helper } from "../../../router";
import { checkSchema } from "express-validator";
import validators, { rejectIfBadRequest } from "../../validators";

export const deviceInfoRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = Router();

    router.get(
        "/",
        checkSchema({ device_uuid: validators.uuid }),
        rejectIfBadRequest,
        helper.getDevice(orm),
        async (req: Request, res: Response) => {
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
        }
    );

    return router;
};

const infoReq = {
    device_uuid: "string",
};
