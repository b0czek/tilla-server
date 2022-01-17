import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import express from "express";
import { helper } from "..";
import { Dispatcher, sensorFields } from "../../dispatcher";
import { Device } from "../../entities/Device";
import { Sensor } from "../../entities/Sensor";
import { RemoteSensor } from "../../entities/RemoteSensor";
import { colorRegex, FieldPriority, RemoteSensorField } from "../../entities/RemoteSensorField";

export const remoteRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = express.Router();

    router.post(
        "/register",
        helper.verifyReq(remoteSensorRegistrationProps),
        helper.getDevice(orm),
        async (req, res) => {
            let props: RemoteSensorRegistrationProps = req.body;
            let device: Device = res.locals.device;

            // #region sensor fields validation
            if (!Array.isArray(props.fields)) {
                return helper.badRequest(res, "fields must be an array");
            }
            if (props.fields.length === 0) {
                return helper.badRequest(res, "remote sensor has to have at least one field");
            }
            for (let field of props.fields) {
                if (typeof field !== "object" || Array.isArray(field) || field === null) {
                    return helper.badRequest(res, "invalid remote sensor field");
                }
                let valid = helper.verifyObject(remoteSensorFieldProps, field);
                if (valid !== true) {
                    return helper.badRequest(res, `invalid field ${valid}`);
                }
                if (field.label.length < 3) {
                    return helper.badRequest(res, `field label cannot be shorter than 3 letters`);
                }
                if (!colorRegex.test(field.color)) {
                    return helper.badRequest(res, "field color invalid");
                }
                if (!Object.values(FieldPriority).includes(field.priority)) {
                    return helper.badRequest(res, "field priority invalid");
                }
                if (!sensorFields.includes(field.name)) {
                    return helper.badRequest(res, "field name invalid");
                }
                if (props.fields.filter((f) => f.name === field.name).length !== 1) {
                    return helper.badRequest(res, "field name cannot occur more than once");
                }
                if (props.fields.filter((f) => f.priority === field.priority).length !== 1) {
                    return helper.badRequest(res, "field priority cannot overlap");
                }
            }
            // #endregion

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
        helper.verifyReq({ device_uuid: "string", remote_sensor_uuid: "string" }),
        helper.getDevice(orm),
        async (req, res) => {
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

const remoteSensorFieldProps = {
    name: "string",
    label: "string",
    color: "string",
    priority: "number",
    range_min: "number",
    range_max: "number",
};

interface RemoteSensorFieldProps {
    name: typeof sensorFields[number];
    label: string;
    color: string;
    priority: number;
    range_min: number;
    range_max: number;
}

const remoteSensorRegistrationProps = {
    device_uuid: "string",
    remote_sensor_uuid: "string",
    remote_device_uuid: "string",
    polling_interval: "number",
    max_sample_age: "number",
    fields: "object",
};

interface RemoteSensorRegistrationProps {
    device_uuid: string;
    remote_sensor_uuid: string;
    remote_device_uuid: string;
    polling_interval: number;
    max_sample_age: number;
    fields: RemoteSensorFieldProps[];
}
