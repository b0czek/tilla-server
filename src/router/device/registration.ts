import { IDatabaseDriver, MikroORM, Connection, NotFoundError } from "@mikro-orm/core";
import express, { Response } from "express";
import { isIPv4 } from "net";
import { register, RegistrationProps } from "../../dispatcher/register";
import { Device } from "../../entities/Device";
import { helper } from "..";
import { Registration, RegistrationResponse } from "../../api";
import { Dispatcher } from "../../dispatcher";

export const registrationProps = {
    ip: "string",
    name: "string",
    polling_interval: "number",
};

export const registrationRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = express.Router();

    router.post("/register", helper.verifyReq(registrationProps), async (req, res) => {
        let body: RegistrationProps = req.body;

        let device!: Device;
        try {
            device = await register(orm.em, body);
        } catch (err) {
            return helper.error(503, res, err.message);
        }

        try {
            await dispatcher.reloadWorker(device.device_uuid);
        } catch (err) {
            return helper.error(500, res, "device was registered, but its worker could not be dispatched", {
                device_id: device.device_uuid,
            });
        }

        return res.json({
            error: false,
            // id of newly created device
            device_id: device.device_uuid,
        });
    });

    router.post("/unregister", helper.verifyReq(unregisterReqBody), helper.getDevice(orm), async (req, res) => {
        let body: UnregisterReqBody = req.body;
        try {
            let unreg = await Registration.Unregister.fetch({
                ip: res.locals.device.device_ip,
                auth_key: res.locals.device.auth_key,
            });
            if (unreg.code !== 0 || unreg.error !== false) {
                throw new Error();
            }
        } catch (err) {
            return helper.error(503, res, "unregistration failed");
        }

        try {
            await orm.em.removeAndFlush(res.locals.device);
        } catch (err) {
            console.error(err);

            return helper.error(500, res, "device unregistered but could not be removed from database");
        }

        try {
            await dispatcher.removeWorker(res.locals.device.device_uuid, {
                removeRedisHistory: true,
            });
        } catch (err) {
            console.error(err);
            return helper.error(500, res, "device unregistered but device worker could not be unregistered");
        }

        return res.json({
            error: false,
        });
    });

    return router;
};
const unregisterReqBody = {
    device_uuid: "string",
};

interface UnregisterReqBody {
    device_uuid: string;
}
