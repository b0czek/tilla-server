import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import express, { Router } from "express";
import { Device } from "../../entities/Device";
import { ISensorData, ISensorsInfo, Sensors } from "../../api";
import { helper } from "..";
import { Sensor } from "../../entities/Sensor";
import { Dispatcher, Sample } from "../../dispatcher";

export const sensorRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = Router();

    router.get("/list", helper.verifyReq(sensorListProps), helper.getDevice(orm), async (req, res) => {
        let device: Device = res.locals.device;

        try {
            let data = await Sensors.Data.fetch({
                auth_key: device.auth_key,
                ip: device.device_ip,
            });
            return res.json({
                error: false,
                ...data,
            });
        } catch (err) {
            return helper.error(503, res, "could not retrieve sensor list");
        }
    });

    router.get("/listRegistered", helper.verifyReq(sensorListProps), helper.getDevice(orm), async (req, res) => {
        let device: Device = res.locals.device;

        try {
            let data = await device.sensors.init();
            return res.json({
                error: false,
                sensors: helper.omitFields(data.getItems(), ["device", "id"]),
            });
        } catch (err) {
            return helper.error(503, res, "could not retrieve sensor list");
        }
    });

    router.get("/data", helper.verifyReq({ device_uuid: "string" }), (req, res) => {
        let worker = dispatcher.workers.find((worker) => worker.uuid === req.query.device_uuid);

        if (!worker) {
            return helper.badRequest(res, "no device with given uuid is dispatched");
        }
        let sensors = worker.sensorsData;

        if (req.query.sensor_uuid) {
            let sensor = worker.sensorsData.find((sensor) => sensor.sensor.sensor_uuid === req.query.sensor_uuid);
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
    });

    router.get("/history", helper.verifyReq({ device_uuid: "string", sensor_uuid: "string" }), async (req, res) => {
        let worker = dispatcher.workers.find((worker) => worker.uuid === req.query.device_uuid);

        if (!worker) {
            return helper.badRequest(res, "no device with given uuid is dispatched");
        }

        let sensor = worker.sensorsData.find((sensor) => sensor.sensor.sensor_uuid === req.query.sensor_uuid);
        if (!sensor) {
            return helper.badRequest(res, "no sensor with given uuid is dispatched");
        }
        console.log(`age: ${JSON.stringify(req.query)}`);
        if (req.query.age && typeof req.query.age !== "number") {
            return helper.badRequest(res, "invalid age");
        }
        let age = <number>(<any>req.query.age) ?? +Date.now();

        let samples = (await worker.getSamples(sensor, age)).map((sample) => <Sample>JSON.parse(sample));

        return res.json({
            error: false,
            samples: samples,
        });
    });

    router.post("/register", helper.verifyReq(sensorRegistrationProps), helper.getDevice(orm), async (req, res) => {
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

        let sensorInfo: ISensorsInfo;
        try {
            sensorInfo = await Sensors.Data.fetch({
                auth_key: device.auth_key,
                ip: device.device_ip,
            });
        } catch (err) {
            return helper.error(503, res, "could not retrieve sensor list");
        }

        body.type = body.type.toLowerCase();
        if (!(body.type in sensorInfo)) {
            return helper.badRequest(res, "no sensor of given type");
        }

        if (sensorInfo[body.type].error) {
            return helper.error(503, res, "given type of sensor is unavailable");
        }

        if (!(body.address in sensorInfo[body.type].sensors)) {
            return helper.badRequest(res, "no sensor of given address");
        }

        let sensor = orm.em.create(Sensor, {
            address: body.address,
            type: body.type,
            name: body.name,
            buffer_expiration_time: body.buffer_expiration_time,
            device,
        });
        await orm.em.persistAndFlush(sensor);

        return res.json({
            error: false,
            sensor_uuid: sensor.sensor_uuid,
        });
    });

    return router;
};

const sensorListProps = {
    device_uuid: "string",
};

interface SensorListProps {
    device_uuid: string;
}

const sensorRegistrationProps = {
    device_uuid: "string",
    name: "string",
    type: "string",
    address: "string",
    buffer_expiration_time: "number",
};

interface SensorRegisrationProps {
    device_uuid: string;
    name: string;
    type: string;
    address: string;
    buffer_expiration_time: number;
}
