import { DS18B20 } from "./ds18b20";
import { BME280 } from "./bme280";
import { QueryApi, QueryParamsAuth } from "..";

class SensorData extends QueryApi {
    protected static uri = "/sensors/";
    public static fetch = (params: QueryParamsAuth) => super._fetch<ISensorsInfo, QueryParamsAuth>(params);

    /**
     * function fetching sensors information and checking if queried sensor is in there
     * @param sensor_type type of a sensor to check availability
     * @param sensor_address address of a sensor to check availability
     * @param queryParams params of standard fetch
     * @returns data of fetched sensor
     * @throws `FetchError` with `statusCode` as property containing http code
     */
    public static async fetchOrFail(
        sensor_type: string,
        sensor_address: string,
        queryParams: QueryParamsAuth
    ): Promise<ISensorData> {
        let sensorInfo!: ISensorsInfo;
        try {
            sensorInfo = await this.fetch({
                auth_key: queryParams.auth_key,
                ip: queryParams.ip,
            });
        } catch (err) {
            throw new FetchError("could not retrieve sensor list", 503);
        }
        sensor_type = sensor_type.toLowerCase();
        if (!(sensor_type in sensorInfo)) {
            throw new FetchError("no sensor of given type", 400);
        }

        if (sensorInfo[sensor_type].error) {
            throw new FetchError("given type of sensor is unavailable", 503);
        }

        if (!(sensor_address in sensorInfo[sensor_type].sensors)) {
            throw new FetchError("no sensor of given address", 400);
        }
        return sensorInfo[sensor_type].sensors[sensor_address];
    }
}

export class FetchError extends Error {
    public statusCode: number;
    constructor(message: string, statusCode: number) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
    }
}
FetchError.prototype.name = "FetchError";

export interface ISensorsInfo {
    [type: string]: ISensorInfo;
}

export const Sensors = {
    Data: SensorData,
    DS18B20: typeof DS18B20,
    BME280: typeof BME280,
};

export interface ISensorData {
    error: number;
    temperature?: number | null;
    humidity?: number | null;
    pressure?: number | null;
}

export interface ISensorInfo {
    error: number;
    sensors: { [id: string]: ISensorData };
}

export default Sensors;
