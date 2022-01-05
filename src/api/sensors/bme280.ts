import { ISensorInfo, QueryApi, QueryParamsAuth } from "..";

class BME280Data extends QueryApi {
    protected static uri = "/sensors/bme280";
    public static fetch = (params: QueryParamsAuth) => super._fetch<ISensorInfo, QueryParamsAuth>(params);
}

export const BME280 = {
    Data: BME280Data,
};
