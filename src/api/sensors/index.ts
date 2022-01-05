import { DS18B20 } from "./ds18b20";
import { BME280 } from "./bme280";
import { QueryApi, QueryParamsAuth } from "..";

class SensorData extends QueryApi {
    protected static uri = "/sensors/";
    public static fetch = (params: QueryParamsAuth) => super._fetch<ISensorsInfo, QueryParamsAuth>(params);
}

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
