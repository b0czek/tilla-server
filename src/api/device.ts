import { QueryApi, QueryParamsAuth } from ".";

class DeviceInfo extends QueryApi {
    protected static uri = "/device/";
    public static fetch = (params: QueryParamsAuth) => super._fetch<IDevice, QueryParamsAuth>(params);
}
class ChipInfo extends QueryApi {
    protected static uri = "/device/chip/";
    public static fetch = (params: QueryParamsAuth) => super._fetch<IChipInfo, QueryParamsAuth>(params);
}
class InterfacesInfo extends QueryApi {
    protected static uri = "/device/network/";
    public static fetch = (params: QueryParamsAuth) => super._fetch<IInterfacesInfo, QueryParamsAuth>(params);
}
class Stats extends QueryApi {
    protected static uri = "/device/stats/";
    public static fetch = (params: QueryParamsAuth) => super._fetch<IStats, QueryParamsAuth>(params);
}
class Restart extends QueryApi {
    protected static uri = "/device/restart/";
    public static fetch = (params: QueryParamsAuth) => super._fetch<IRestart, QueryParamsAuth>(params);
}

export const Device = {
    DeviceInfo,
    ChipInfo,
    InterfacesInfo,
    Stats,
    Restart,
};

//#region types
export interface IRestart {
    ok: boolean;
}

export interface IStats {
    uptime: number;
    available_memory: number;
}

export interface IIPInfo {
    ip: string;
    netmask: string;
    gw: string;
}

export interface IDNSInfo {
    primary_dns: number;
    secondary_dns: number;
}

export interface IWifiInfo {
    bssid: string;
    ssid: string;
    rssi: number;
    auth_mode: number;
    country_code: string;
}

export interface INetwork {
    mac_address: string;
    ip_info: IIPInfo;
    dns: IDNSInfo;
    hostname: string;
    connected: boolean;
    is_static: boolean;
    wifi_info?: IWifiInfo;
}

export interface IInterfacesInfo {
    sta?: INetwork;
    eth?: INetwork;
    error: boolean;
}

export interface IChipInfo {
    chip_model: number;
    features: number;
    cores: number;
    revision: number;
    chip_id: string;
}

export interface IDevice {
    stats: IStats;
    interfaces_info: IInterfacesInfo;
    chip_info: IChipInfo;
}
//#endregion
