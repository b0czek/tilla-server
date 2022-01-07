import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import express from "express";
import { RegistrationProps } from "../../api";
import { helper } from "..";
import { Device } from "../../entities/Device";
import { registrationProps } from "./registration";
import { Dispatcher } from "../../dispatcher";
import { areRegistrationPropsValid } from ".";

export const deviceEndpoints = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = express.Router();

    router.get("/list", async (req, res) => {
        try {
            let devices = await orm.em.find(Device, {});

            let omitted = helper.omitFields(devices, ["id", "sensors", "auth_key"] as const);
            res.json({
                error: false,
                devices: omitted,
            });
        } catch (err) {
            helper.error(500, res, "could not fetch device list");
        }
    });

    router.post("/edit", helper.verifyReq(deviceEditProps, true), helper.getDevice(orm), async (req, res) => {
        let device: DeviceEditProps = res.locals.device;

        const changedFields: Partial<DeviceEditProps> = Object.fromEntries(
            Object.entries(res.locals.object).filter(([key, value]) => value !== device![<keyof typeof device>key])
        );

        if (Object.keys(changedFields).length === 0) {
            return helper.badRequest(res, "no field was changed");
        }

        let areValid = areRegistrationPropsValid(device);
        if (areValid !== true) {
            return helper.badRequest(res, areValid);
        }

        if ("ip" in changedFields) {
            let sameDeviceIP = await orm.em.count(Device, {
                ip: changedFields.ip,
            });
            if (sameDeviceIP != 0) {
                return helper.badRequest(res, "there is already device with the same ip address");
            }
        }

        device = orm.em.assign(device, changedFields);

        try {
            await orm.em.persistAndFlush(device);
        } catch (err) {
            return helper.error(500, res, "could not modify entity");
        }
        try {
            await dispatcher.reloadWorker(device.device_uuid);
        } catch (err) {
            return helper.error(500, res, "entity was modified but its worker could not be reloaded", {
                changedFields,
            });
        }
        return res.json({
            error: false,
            changedFields,
        });
    });

    return router;
};

export interface DeviceEditProps extends RegistrationProps {
    device_uuid: string;
}

const deviceEditProps = {
    ...registrationProps,
    device_uuid: "string",
};
