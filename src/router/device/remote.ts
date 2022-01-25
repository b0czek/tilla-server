import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import express, { Request, Response } from "express";
import { helper } from "..";
import { Dispatcher, sensorFields } from "../../dispatcher";
import { Device } from "../../entities/Device";
import { Sensor } from "../../entities/Sensor";
import { RemoteSensor } from "../../entities/RemoteSensor";
import { colorRegex, FieldPriority, RemoteSensorField } from "../../entities/RemoteSensorField";
import { checkSchema, Schema } from "express-validator";
import validators, { rejectIfBadRequest } from "../validators";

export const remoteRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = express.Router();

    router.post(
        "/register",
        checkSchema(remoteSensorRegistrationSchema),
        rejectIfBadRequest,
        helper.getDevice(orm),
        async (req: Request, res: Response) => {
            let props: RemoteSensorRegistrationProps = req.body;
            let device: Device = res.locals.device;

            // #region check if sensor  is already registered on this device

            let presentRemoteSensors = (await device.remote_sensors.init()).getItems();
            let existingSensor = presentRemoteSensors.find(
                (remote_sensor) => remote_sensor.sensor.sensor_uuid === props.remote_sensor_uuid
            );

            if (existingSensor) {
                return helper.badRequest(res, "sensor of this uuid is already registered on this device");
            }
            // #endregion

            let remoteDevice: Device | null;
            let sensor: Sensor | null;

            try {
                remoteDevice = await orm.em.findOne(Device, {
                    device_uuid: props.remote_device_uuid,
                });
                if (!remoteDevice) {
                    return helper.badRequest(res, "remote device not found");
                }
                sensor = await orm.em.findOne(Sensor, {
                    device: remoteDevice,
                    sensor_uuid: props.remote_sensor_uuid,
                });
                if (!sensor) {
                    return helper.badRequest(res, "remote sensor not found");
                }
            } catch (err) {
                return helper.error(500, res, "could not retrieve data from database");
            }

            if (props.max_sample_age > sensor.buffer_expiration_time) {
                return helper.badRequest(res, "max sample age cannot be greater than sensor's buffer expiration time");
            }

            // create the remote sensor
            let remoteSensor = orm.em.create(RemoteSensor, {
                device: device,
                sensor: sensor,
                polling_interval: props.polling_interval,
                max_sample_age: props.max_sample_age,
            });
            // create fields for the remote sensor,
            let fields = props.fields.map((field) => {
                let { color, ...f } = field;

                return orm.em.create(RemoteSensorField, {
                    color: Number(color),
                    ...f,
                    remote_sensor: remoteSensor,
                });
            });
            // and try to persist them
            try {
                await orm.em.persistAndFlush([remoteSensor, ...fields]);
            } catch (err) {
                return helper.error(500, res, "entity could not be persisted");
            }
            return res.json({
                error: false,
                remote_sensor_uuid: remoteSensor.remote_sensor_uuid,
            });
        }
    );

    router.post(
        "/unregister",
        checkSchema({
            device_uuid: validators.uuid,
            remote_sensor_uuid: validators.uuid,
        }),
        rejectIfBadRequest,
        helper.getDevice(orm),
        async (req: Request, res: Response) => {
            let device: Device = res.locals.device;
            let remoteSensors!: RemoteSensor[];
            try {
                remoteSensors = (await device.remote_sensors.init()).getItems();
            } catch (err) {
                return helper.error(500, res, "could not fetch remote sensors from database");
            }

            let remoteSensor = remoteSensors.find(
                (remoteSensor) => remoteSensor.remote_sensor_uuid === req.body.remote_sensor_uuid
            );

            if (!remoteSensor) {
                return helper.badRequest(res, "could not unregister non-existent remote sensor");
            }

            try {
                await orm.em.removeAndFlush(remoteSensor);
            } catch (err) {
                return helper.error(500, res, "remote sensor could not be removed from database");
            }

            return res.json({
                error: false,
            });
        }
    );

    return router;
};

const hasDuplicates = (arr: any[]) => arr.length !== new Set(arr).size;

const remoteSensorRegistrationSchema: Schema = {
    device_uuid: validators.uuid,
    remote_device_uuid: validators.uuid,
    remote_sensor_uuid: validators.uuid,
    polling_interval: validators.int,
    max_sample_age: validators.int,

    fields: {
        isArray: {
            bail: true,
            options: {
                min: 1,
            },
        },
        custom: {
            bail: true,
            options: (array: RemoteSensorFieldProps[]) =>
                !hasDuplicates(array.map((field) => field.priority)) &&
                !hasDuplicates(array.map((field) => field.name)),
            errorMessage: "there must not be overlaps of priority and name in fields",
        },
    },

    "fields.*.name": {
        ...validators.string,
        isIn: {
            bail: true,
            options: [sensorFields],
        },
    },
    "fields.*.label": {
        ...validators.string,
        isLength: {
            bail: true,
            options: {
                min: 3,
            },
        },
    },
    "fields.*.color": {
        ...validators.string,
        matches: {
            bail: true,
            options: colorRegex,
        },
    },
    "fields.*.priority": {
        ...validators.int,

        isIn: {
            bail: true,
            options: [Object.values(FieldPriority)],
        },
    },
    "fields.*.range_min": validators.int,
    "fields.*.range_max": validators.int,
};

interface RemoteSensorFieldProps {
    name: typeof sensorFields[number];
    label: string;
    color: string;
    unit: string;
    priority: number;
    range_min: number;
    range_max: number;
}

interface RemoteSensorRegistrationProps {
    device_uuid: string;
    remote_sensor_uuid: string;
    remote_device_uuid: string;
    polling_interval: number;
    max_sample_age: number;
    fields: RemoteSensorFieldProps[];
}
