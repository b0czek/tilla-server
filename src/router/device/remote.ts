import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import express from "express";
import { helper } from "..";
import { Device } from "../../entities/Device";
import { Dispatcher } from "../../dispatcher";
import { Sensor } from "../../entities/Sensor";
import { RemoteSensor } from "../../entities/RemoteSensor";

export const remoteRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = express.Router();

    router.post(
        "/register",
        helper.verifyReq(remoteSensorRegistrationProps),
        helper.getDevice(orm),
        async (req, res) => {
            let props: RemoteSensorRegistrationProps = req.body;

            let device: Device = res.locals.device;

            let presentRemoteSensors = (await device.remote_sensors.init()).getItems();
            let existingSensor = presentRemoteSensors.find(
                (remote_sensor) => remote_sensor.sensor.sensor_uuid === props.remote_sensor_uuid
            );

            if (existingSensor) {
                return helper.badRequest(res, "sensor of this uuid is already registered on this device");
            }

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
            let remoteSensor = orm.em.create(RemoteSensor, {
                device: remoteDevice,
                sensor: sensor,
                polling_interval: props.polling_interval,
                max_sample_age: props.max_sample_age,
            });
            try {
                await orm.em.persistAndFlush(remoteSensor);
            } catch (err) {
                return helper.error(500, res, "entity could not be persisted");
            }
            return res.json({
                error: false,
                remote_sensor_uuid: remoteSensor.remote_sensor_uuid,
            });
        }
    );

    return router;
};

const remoteSensorRegistrationProps = {
    device_uuid: "string",
    remote_sensor_uuid: "string",
    remote_device_uuid: "string",
    polling_interval: "number",
    max_sample_age: "number",
};

interface RemoteSensorRegistrationProps {
    device_uuid: string;
    remote_sensor_uuid: string;
    remote_device_uuid: string;
    polling_interval: number;
    max_sample_age: number;
}
