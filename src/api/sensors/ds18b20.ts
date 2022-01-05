import { ISensorInfo, QueryApi, QueryParamsAuth } from "..";

class DS18B20Data extends QueryApi {
    protected static uri = "/sensors/ds18b20";
    public static fetch = (params: QueryParamsAuth) => super._fetch<ISensorInfo, QueryParamsAuth>(params);
}
class DS18B20Config extends QueryApi {
    protected static uri = "/sensors/ds18b20/config";
    public static fetch = (params: QueryParamsAuth) => super._fetch<IDS18B20Config, QueryParamsAuth>(params);
}

export const DS18B20 = {
    Data: DS18B20Data,
    Config: DS18B20Config,
};

export interface IDS18B20Config {
    reading_interval: number;
    resolution: number;
    gpio: number;
}
