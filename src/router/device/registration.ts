import { IDatabaseDriver, MikroORM, Connection, NotFoundError } from "@mikro-orm/core";
import express, { Request, Response } from "express";
import { Device } from "../../entities/Device";
import { helper } from "..";
import { Registration, RegistrationResponse, RegistrationProps } from "../../api";
import { Dispatcher } from "../../dispatcher";
import { areRegistrationPropsValid } from ".";
import { checkSchema, Schema } from "express-validator";
import validators, { rejectIfBadRequest } from "../validators";

export const registrationSchema: Schema = {
    ip: validators.ipv4,
    name: validators.string,
    polling_interval: validators.int,
};

export const registrationRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = express.Router();

    router.post(
        "/register",
        checkSchema(registrationSchema),
        rejectIfBadRequest,
        async (req: Request, res: Response) => {
            let body: RegistrationProps = req.body;

            let areValid = areRegistrationPropsValid(body);
            if (areValid !== true) {
                return helper.badRequest(res, areValid);
            }

            let device!: Device;
            try {
                device = await Registration.Register.execute(orm.em, body);
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

            return res.status(201).json({
                error: false,
                // id of newly created device
                device_uuid: device.device_uuid,
            });
        }
    );

    router.post(
        "/unregister",
        checkSchema({ device_uuid: validators.uuid }),
        rejectIfBadRequest,
        helper.getDevice(orm),
        async (req: Request, res: Response) => {
            try {
                let unreg = await Registration.Unregister.fetch({
                    ip: res.locals.device.ip,
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
        }
    );
    // device unregistration without unregistering process on device itself
    router.post(
        "/delete",
        checkSchema({ device_uuid: validators.uuid }),
        rejectIfBadRequest,
        helper.getDevice(orm),
        async (req: Request, res: Response) => {
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
        }
    );

    return router;
};
