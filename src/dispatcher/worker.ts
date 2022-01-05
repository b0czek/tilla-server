import { ISensorData, ISensorsInfo, Sensors } from "../api";
import { Sensor } from "../entities/Sensor";
import { Device } from "../entities/Device";

const RETRY_COUNT = 3;
const SAMPLE_BUFFER_SIZE = 100;

interface ISensor {
    data: ISensorData;
    buffer: SampleBuffer;
    sensor: Sensor;
}

export class DispatcherWorker {
    private device: Device;
    private pollInterval: NodeJS.Timeout | null = null;
    public uuid: string;
    public online: boolean = false;

    public sensorsData: ISensor[] = [];

    constructor(device: Device) {
        this.device = device;
        this.uuid = device.device_uuid;
        for (let sensor of device.sensors.getItems()) {
            this.sensorsData.push({
                sensor,
                data: this._getErroredSensorData(),
                buffer: new SampleBuffer(SAMPLE_BUFFER_SIZE),
            });
        }
        setImmediate(async () => await this._pollDevice());
        this.pollInterval = setInterval(this._pollDevice, this.device.polling_interval);
    }

    public stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.pollInterval = null;
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
                sensor.buffer.pushData(sensorData);
            }
        }
    };

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
        sensor.buffer.pushData(newData);
    }

    private _getErroredSensorData(): ISensorData {
        return {
            error: 1,
            temperature: null,
            humidity: null,
            pressure: null,
        };
    }
}

interface Sample {
    date: Date;
    data: ISensorData;
}

class SampleBuffer extends Array<Sample> {
    private bufferSize: number;
    constructor(bufferSize: number) {
        super();
        this.bufferSize = bufferSize;
        super.push();
    }
    public push(...samples: Sample[]): number {
        let overflown: number = Math.max(this.length + samples.length - this.bufferSize, 0);
        if (overflown) {
            for (let i = 0; i < overflown; i++) {
                if (samples.length > this.bufferSize) {
                    samples.shift();
                } else {
                    this.shift();
                }
            }
        }
        return super.push(...samples);
    }
    public pushData(sample: ISensorData): number {
        return this.push({
            data: sample,
            date: new Date(),
        });
    }
}
