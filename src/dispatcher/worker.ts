import { ISensorData, ISensorsInfo, Sensors } from "../api";
import { Sensor } from "../entities/Sensor";
import { Device } from "../entities/Device";
import { RedisClient } from ".";

const RETRY_COUNT = 3;

interface ISensor {
    data: ISensorData;
    sensor: Sensor;
}

export class DispatcherWorker {
    private device: Device;
    private redisClient: RedisClient;
    private pollInterval: NodeJS.Timeout | null = null;
    public uuid: string;
    public online: boolean = false;

    public sensorsData: ISensor[] = [];

    constructor(device: Device, redisClient: RedisClient) {
        this.device = device;
        this.redisClient = redisClient;
        this.uuid = device.device_uuid;
        for (let sensor of device.sensors.getItems()) {
            this._initSensorData(sensor);
        }
        setImmediate(async () => await this._pollDevice());
        this.pollInterval = setInterval(this._pollDevice, this.device.polling_interval);
    }

    public async getSamples(sensor: ISensor, age = +Date.now()) {
        let now = +Date.now();
        await this._removeOldEntries(sensor);
        let since = now - age;
        console.log(since);
        return this.redisClient.zRangeByScore(sensor.sensor.sensor_uuid, since, now);
    }

    public stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.pollInterval = null;
    }
    /**
     * function adding sensor to worker's sensor pool, it must be valid - worker does not have access to database to validate it
     * @param sensor database object of sensor
     */
    public addSensor(sensor: Sensor) {
        console.log(`adding sensor ${sensor.sensor_uuid}`);
        this._initSensorData(sensor);
    }
    /**
     * function updating sensor's data, data must be valid - worker does not have access to database to validate it
     * @param sensor database object of sensor
     */
    public updateSensor(sensor: Sensor) {
        let sensorData = this.sensorsData.find((sensorData) => sensorData.sensor.sensor_uuid === sensor.sensor_uuid);
        if (!sensorData) {
            throw new Error("could not update sensor because it does not exist");
        }
        console.log(`updating sensor ${sensor.sensor_uuid}`);
        sensorData.sensor = sensor;
    }

    public async removeSensor(sensor_uuid: string, options: SensorRemoveOptions = { removeRedisHistory: false }) {
        let idx = this.sensorsData.findIndex((sensorData) => sensorData.sensor.sensor_uuid === sensor_uuid);
        if (idx == -1) {
            throw new Error("could not remove sensor because it does not exist");
        }

        if (options.removeRedisHistory) {
            await this.redisClient.del(sensor_uuid);
        }
        console.log(`removing sensor ${sensor_uuid}`);
        this.sensorsData.splice(idx, 1);
    }

    private _pollDevice = async () => {
        let data!: ISensorsInfo;

        for (let i = 0; i < RETRY_COUNT && !data; i++) {
            try {
                data = await Sensors.Data.fetch({
                    auth_key: this.device.auth_key,
                    ip: this.device.device_ip,
                });
            } catch (err) {
                console.error(`polling device ${this.uuid} failed. `);
            }
        }
        if (!data) {
            this.online = false;
            this.sensorsData.forEach((sensor) => this._errorSensor(sensor));
            return;
        }
        this.online = true;

        for (let sensor of this.sensorsData) {
            let sensorData = this._findSensor(sensor, data);
            if (sensorData === null) {
                this._errorSensor(sensor);
            } else {
                console.log(`${sensor.sensor.sensor_uuid}: ${JSON.stringify(sensorData)}`);
                sensor.data = sensorData;
                await this._addSample(sensor, sensorData);
            }
        }
    };

    // add entry to redis and remove old
    private async _addSample(sensor: ISensor, data: ISensorData) {
        let timestamp = +Date.now();
        try {
            await this.redisClient.zAdd(sensor.sensor.sensor_uuid, {
                score: timestamp,
                value: JSON.stringify({
                    timestamp,
                    ...data,
                }),
            });
            await this._removeOldEntries(sensor, timestamp);
        } catch (err) {
            console.error(err.message);
        }
    }

    // remove entries past expiration date in redis
    private async _removeOldEntries(sensor: ISensor, since = +Date.now()) {
        let olderThan = since - sensor.sensor.buffer_expiration_time;
        return this.redisClient.zRemRangeByScore(sensor.sensor.sensor_uuid, 0, olderThan);
    }

    // find sensor in query result
    private _findSensor(sensor: ISensor, data: ISensorsInfo): ISensorData | null {
        if (!(sensor.sensor.type in data)) {
            return null;
        }
        if (data[sensor.sensor.type].error != 0) {
            return null;
        }
        if (!(sensor.sensor.address in data[sensor.sensor.type].sensors)) {
            return null;
        }
        return data[sensor.sensor.type].sensors[sensor.sensor.address];
    }

    private _errorSensor(sensor: ISensor) {
        let newData = this._getErroredSensorData();
        sensor.data = newData;
        this._addSample(sensor, newData);
    }

    private _getErroredSensorData(): ISensorData {
        return {
            error: 1,
            temperature: null,
            humidity: null,
            pressure: null,
        };
    }

    private _initSensorData(sensor: Sensor) {
        this.sensorsData.push({
            sensor,
            data: this._getErroredSensorData(),
        });
    }
}

export interface SensorRemoveOptions {
    removeRedisHistory: boolean;
}

export interface Sample extends ISensorData {
    timestamp: number;
}
