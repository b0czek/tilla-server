import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import { Router } from "express";
import { Dispatcher, Sample, sensorFields } from "../../dispatcher";
import { Device } from "../../entities/Device";
import { helper } from "..";
import { RemoteSensor } from "../../entities/RemoteSensor";
import { ISensorData } from "src/api";

interface OptimizedSample extends Omit<Sample, "timestamp"> {
    count: number;
}
type IncludedFields = Readonly<Array<typeof sensorFields[number]>>;

const didValuesChange = (
    roundedSample: Sample,
    prevSample: OptimizedSample,
    fieldsToConsider: IncludedFields = sensorFields
): boolean => fieldsToConsider.filter((field) => roundedSample[field] !== prevSample[field]).length > 0;

const calculateAge = (since: number, max_sample_age: number) => Math.min(max_sample_age, +Date.now() - since);

const roundValues = (sample: Sample, fieldsToRound: IncludedFields = sensorFields): Sample => {
    fieldsToRound.forEach((field) => {
        if (field in sample && sample[field]) {
            sample[field] = Math.round(sample[field]!);
        }
    });

    return sample;
};

const createOptimizedSample = (sample: Sample, includedFields: IncludedFields = sensorFields): OptimizedSample => {
    let { timestamp, ...data } = sample;
    let fields = Object.fromEntries(includedFields.map((field) => [field, data[field]]));
    return {
        error: data.error,
        ...fields,
        count: 1,
    };
};

const optimizeSamples = (data: Sample[], includedFields: IncludedFields = sensorFields) => {
    if (data.length === 0) {
        throw new Error("cannot optimize empty dataset");
    }

    let result: OptimizedSample[] = [];

    for (const sample of data) {
        let roundedSample = roundValues(sample, includedFields);
        if (result.length === 0) {
            result.push(createOptimizedSample(roundedSample, includedFields));
            continue;
        }
        // there will always be at least one element in result at this point
        let prevSample = result.at(-1)!;

        if (sample.error != prevSample.error || didValuesChange(roundedSample, prevSample, includedFields)) {
            result.push(createOptimizedSample(roundedSample, includedFields));
        } else {
            prevSample.count++;
        }
    }

    let starting_timestamp = data[0].timestamp;
    let closing_timestamp = data.at(-1)!.timestamp;
    return {
        error: false,
        starting_timestamp,
        closing_timestamp,
        data: result,
    };
};

// endpoints related to device display and them querying data for remote sensor data
export const displayRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = Router();

    router.get("/info", helper.verifyReq(nodeReqBody), helper.getDevice(orm), async (req, res) => {
        let device: Device = res.locals.device;
        if (device.auth_key !== req.query.auth_key) {
            return helper.badRequest(res, "invalid auth key");
        }
        await device.remote_sensors.init();
        let remoteSensors = device.remote_sensors.getItems();
        let sensors_data = await Promise.all(
            remoteSensors.map(async (remoteSensor) => {
                let sensorFields = (await remoteSensor.fields.init())
                    .getItems()
                    .map((field) => helper.omitFields(field, ["id", "remote_sensor"] as const));
                return {
                    device_name: remoteSensor.sensor.device.name,
                    sensor_name: remoteSensor.sensor.name,
                    sensor_type: remoteSensor.sensor.type,
                    remote_sensor_uuid: remoteSensor.remote_sensor_uuid,
                    polling_interval: remoteSensor.polling_interval,
                    max_sample_age: remoteSensor.max_sample_age,
                    sample_count: Math.floor(remoteSensor.max_sample_age / remoteSensor.device.polling_interval),
                    fields: sensorFields,
                };
            })
        );

        return res.json({
            error: false,
            sensors: sensors_data,
        });
    });

    router.get("/data", helper.verifyReq(nodeReqBody), helper.getDevice(orm), async (req, res) => {
        let device: Device = res.locals.device;
        if (device.auth_key !== req.query.auth_key) {
            return helper.badRequest(res, "invalid auth key");
        }
        let remoteSensors = (await device.remote_sensors.init()).getItems();

        let sensors: { [key: string]: ISensorData } = {};

        for (let remoteSensor of remoteSensors) {
            let sensorFieldNames = (await remoteSensor.fields.init())
                .getItems()
                .map((field) => <keyof ISensorData>field.name);

            let worker = dispatcher.findWorker(remoteSensor.sensor.device.device_uuid);
            if (!worker) {
                return helper.badRequest(res, "no remote device of given uuid dispatched");
            }
            let sensor = worker.findSensor(remoteSensor.sensor.sensor_uuid);
            if (!sensor) {
                return helper.badRequest(res, "no remote sensor of given uuid dispatched");
            }
            let data = Object.fromEntries(sensorFieldNames.map((fieldName) => [fieldName, sensor!.data[fieldName]]));
            sensors[remoteSensor.remote_sensor_uuid] = {
                ...data,
                error: sensor.data.error,
            };
        }

        return res.json({
            error: false,
            sensors,
        });
    });

    router.get("/sync", helper.verifyReq(nodeReqBody), helper.getDevice(orm), async (req, res) => {
        let device: Device = res.locals.device;

        if (device.auth_key !== req.query.auth_key) {
            return helper.badRequest(res, "invalid auth key");
        }

        let since = req.query.since ?? 0;
        if (typeof since !== "number") {
            return helper.badRequest(res, "since parameter must be a number");
        }

        let remoteSensors = (await device.remote_sensors.init()).getItems();

        let sensor_uuid_query = req.query.remote_sensor_uuid;
        if (sensor_uuid_query) {
            if (typeof sensor_uuid_query !== "string") {
                return helper.badRequest(res, "sensor_uuid_query must be a string");
            }
            let remoteSensor = remoteSensors.find((rs) => rs.remote_sensor_uuid === sensor_uuid_query);
            if (!remoteSensor) {
                return helper.badRequest(res, "no remote sensor with given uuid");
            }
            remoteSensors = [remoteSensor];
        }
        let sensors: { [key: string]: any } = {};

        for (const remoteSensor of remoteSensors) {
            let worker = dispatcher.findWorker(remoteSensor.sensor.device.device_uuid);
            if (!worker) {
                return helper.badRequest(res, "no remote device of given uuid dispatched");
            }
            let sensor = worker.findSensor(remoteSensor.sensor.sensor_uuid);
            if (!sensor) {
                return helper.badRequest(res, "no remote sensor of given uuid dispatched");
            }
            let age = calculateAge(since, remoteSensor.max_sample_age);

            try {
                let sensorFieldNames = (await remoteSensor.fields.init())
                    .getItems()
                    .map((field) => <typeof sensorFields[number]>field.name);

                let samples = await worker.getSamples(sensor, age);
                let optimizedSamples = optimizeSamples(samples, sensorFieldNames);

                sensors[remoteSensor.remote_sensor_uuid] = {
                    device_online: worker.online,
                    new_samples_count: samples.length,
                    current_values: Object.fromEntries(
                        sensorFieldNames.map((fieldName) => [fieldName, sensor!.data[fieldName]])
                    ),
                    ...optimizedSamples,
                };
            } catch (err) {
                console.error(err.message);
                sensors[remoteSensor.remote_sensor_uuid] = { error: true };
            }
        }
        return res.json({
            error: false,
            sensors,
        });
    });

    return router;
};

const nodeReqBody = {
    device_uuid: "string",
    auth_key: "string",
};

interface NodeReqBody {
    device_uuid: "string";
    auth_key: "string";
}
