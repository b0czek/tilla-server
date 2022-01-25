import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import { checkSchema, Schema, validationResult } from "express-validator";
import express, { Request, Response, Router } from "express";
import { Device } from "../../entities/Device";
import { FetchError, ISensorData, ISensorsInfo, Sensors } from "../../api";
import { helper } from "..";
import { Sensor } from "../../entities/Sensor";
import { Dispatcher, Sample } from "../../dispatcher";
import validators, { objectFromSchema, rejectIfBadRequest } from "../validators";

export const sensorRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = Router();

    router.get(
        "/list",
        checkSchema({
            device_uuid: validators.uuid,
        }),
        rejectIfBadRequest,
        helper.getDevice(orm),
        async (req: Request, res: Response) => {
            let device: Device = res.locals.device;

            try {
                let data = await Sensors.Data.fetch({
                    auth_key: device.auth_key,
                    ip: device.ip,
                });
                return res.json({
                    error: false,
                    sensors: data,
                });
            } catch (err) {
                return helper.error(503, res, "could not retrieve sensor list");
            }
        }
    );

    router.get(
        "/listRegistered",
        checkSchema({
            device_uuid: validators.uuid,
        }),
        rejectIfBadRequest,
        helper.getDevice(orm),
        async (req: Request, res: Response) => {
            let device: Device = res.locals.device;

            try {
                let data = await device.sensors.init();
                return res.json({
                    error: false,
                    sensors: helper.omitFields(data.getItems(), ["device", "id", "subscribers"]),
                });
            } catch (err) {
                return helper.error(503, res, "could not retrieve sensor list");
            }
        }
    );

    router.get(
        "/data",
        checkSchema({
            device_uuid: validators.uuid,
            sensor_uuid: {
                ...validators.uuid,
                optional: true,
            },
        }),
        rejectIfBadRequest,

        (req: Request, res: Response) => {
            let worker = dispatcher.findWorker(<string>req.query.device_uuid);

            if (!worker) {
                return helper.badRequest(res, "no device with given uuid is dispatched");
            }
            let sensors = worker.sensorsData;

            if (req.query.sensor_uuid) {
                let sensor = worker.findSensor(<string>req.query.sensor_uuid);
                if (!sensor) {
                    return helper.badRequest(res, "no sensor with given uuid is dispatched");
                }
                sensors = [sensor];
            }
            let data = Object.fromEntries(sensors.map((sensor) => [sensor.sensor.sensor_uuid, sensor.data]));

            return res.json({
                error: false,
                device_online: worker.online,
                data,
            });
        }
    );

    router.get(
        "/history",
        checkSchema({
            device_uuid: validators.uuid,
            sensor_uuid: validators.uuid,
            age: {
                ...validators.int,
                optional: true,
            },
        }),
        rejectIfBadRequest,
        async (req: Request, res: Response) => {
            let worker = dispatcher.findWorker(<string>req.query.device_uuid);

            if (!worker) {
                return helper.badRequest(res, "no device with given uuid is dispatched");
            }

            let sensor = worker.findSensor(<string>req.query.sensor_uuid);
            if (!sensor) {
                return helper.badRequest(res, "no sensor with given uuid is dispatched");
            }
            let age = <number>(<any>req.query.age);

            let samples = await worker.getSamples(sensor, age);

            return res.json({
                error: false,
                samples: samples,
            });
        }
    );

    router.post(
        "/register",
        checkSchema(sensorRegistrationSchema, ["body"]),
        rejectIfBadRequest,
        helper.getDevice(orm),
        async (req: Request, res: Response) => {
            let body: SensorRegisrationProps = req.body;
            let device: Device = res.locals.device;
            await device.sensors.init({
                where: {
                    type: body.type,
                    address: body.address,
                },
            });
            if (device.sensors.length != 0) {
                return helper.badRequest(res, "sensor already registered");
            }

            try {
                await Sensors.Data.fetchOrFail(body.type, body.address, {
                    auth_key: device.auth_key,
                    ip: device.ip,
                });
            } catch (err) {
                // error will always be fetcherror
                return helper.error(err.statusCode, res, err.message);
            }

            let sensor = orm.em.create(Sensor, {
                address: body.address,
                type: body.type,
                name: body.name,
                buffer_expiration_time: body.buffer_expiration_time,
                device,
            });
            try {
                await orm.em.persistAndFlush(sensor);
            } catch (err) {
                return helper.error(500, res, "could not add register sensor in database");
            }

            let worker = dispatcher.findWorker(device.device_uuid);
            if (!worker) {
                return helper.error(500, res, "sensor registered, but its device worker does not work", {
                    sensor_uuid: sensor.sensor_uuid,
                });
            }
            worker.addSensor(sensor);

            return res.status(201).json({
                error: false,
                sensor_uuid: sensor.sensor_uuid,
            });
        }
    );

    router.post(
        "/edit",
        checkSchema(sensorEditSchema, ["body"]),
        rejectIfBadRequest,
        helper.getDevice(orm),
        async (req: Request, res: Response) => {
            let body = <SensorEditProps>req.body;
            let device = <Device>res.locals.device;
            let sensor = await orm.em.findOne(Sensor, {
                sensor_uuid: body.sensor_uuid,
            });

            if (!sensor) {
                return helper.badRequest(res, "no sensor with given uuid found ");
            }
            // remove device uuid from object
            console.log(objectFromSchema(sensorEditSchema, req.body));
            let { device_uuid, ...obj } = <SensorEditProps>objectFromSchema(sensorEditSchema, req.body);
            const changedFields = <Partial<SensorEditProps>>(
                Object.fromEntries(
                    Object.entries(obj).filter(([key, value]) => value !== sensor![<keyof typeof sensor>key])
                )
            );

            if (Object.keys(changedFields).length === 0) {
                return helper.badRequest(res, "no field was changed");
            }
            // check if important data changed
            if ("type" in changedFields || "address" in changedFields) {
                // if particular field didn't change, get value from actual object
                let address = changedFields.address ?? sensor.address;
                let type = changedFields.type ?? sensor.type;

                try {
                    // fetch db for same sensor config
                    await device.sensors.init({
                        where: {
                            type,
                            address,
                        },
                    });
                } catch (err) {
                    return helper.error(500, res, "could not fetch database");
                }
                // if there is one already, send bad request
                if (device.sensors.length !== 0) {
                    return helper.badRequest(res, "sensor with given type and address already exists");
                }
                // if there is not, check if the sensor is available on device
                try {
                    await Sensors.Data.fetchOrFail(type, address, {
                        ip: device.ip,
                        auth_key: device.auth_key,
                    });
                } catch (err) {
                    return helper.error(err.statusCode, res, err.message);
                }
            }

            sensor = orm.em.assign(sensor, changedFields);

            try {
                await orm.em.persistAndFlush(sensor);
            } catch (err) {
                return helper.error(500, res, "could not modify entity");
            }

            let worker = dispatcher.findWorker(device_uuid);
            if (!worker) {
                return helper.error(500, res, "sensor updated but its device worker does not work", {
                    changedFields,
                });
            }
            worker.updateSensor(sensor);

            return res.json({
                error: false,
                changedFields,
            });
        }
    );

    router.post(
        "/unregister",
        checkSchema({
            device_uuid: validators.uuid,
            sensor_uuid: validators.uuid,
        }),
        rejectIfBadRequest,
        helper.getDevice(orm),
        async (req: Request, res: Response) => {
            let body: SensorUnregisterProps = req.body;
            let device: Device = res.locals.device;
            await device.sensors.init({
                where: {
                    sensor_uuid: body.sensor_uuid,
                },
            });

            let sensor = device.sensors.getItems().pop();
            if (!sensor) {
                return helper.badRequest(res, "no sensor with given uuid is registered on this device");
            }
            try {
                await orm.em.removeAndFlush(sensor);
            } catch (err) {
                return helper.error(500, res, "could not unregister sensor");
            }

            let worker = dispatcher.findWorker(device.device_uuid);
            if (worker) {
                // exception can basically be thrown only when removing redis history
                try {
                    await worker.removeSensor(body.sensor_uuid, {
                        removeRedisHistory: true,
                    });
                } catch (err) {
                    // so don't signalize error if it fails
                    console.error(err.message);
                }
            }

            return res.json({
                error: false,
            });
        }
    );

    return router;
};

interface SensorUnregisterProps {
    device_uuid: string;
    sensor_uuid: string;
}

const sensorRegistrationSchema: Schema = {
    device_uuid: validators.uuid,
    name: {
        ...validators.string,
        isLength: {
            bail: true,
            options: {
                min: 3,
                max: 10,
            },
        },
    },
    type: validators.string,
    address: validators.string,
    buffer_expiration_time: validators.int,
};

interface SensorRegisrationProps {
    device_uuid: string;
    name: string;
    type: string;
    address: string;
    buffer_expiration_time: number;
}

const sensorEditSchema: Schema = {
    ...sensorRegistrationSchema,
    sensor_uuid: validators.uuid,
};

interface SensorEditProps extends SensorRegisrationProps {
    sensor_uuid: string;
}
