import { randomFillSync } from "crypto";
import { QueryApi, QueryParams, QueryParamsAuth } from ".";

interface RegistrationParams extends QueryParams {
    body: { auth_key: string };
}

class RegistrationInfo extends QueryApi {
    protected static uri = "/registration/info/";
    public static fetch = (params: QueryParams) => super._fetch<IRegistrationInfo, QueryParams>(params);
}

class RegistrationRegister extends QueryApi {
    protected static uri = "/registration/register/";
    protected static method = "POST";
    public static fetch = (params: RegistrationParams) =>
        super._fetch<RegistrationResponse, RegistrationParams>(params);
}

class RegistrationUnregister extends QueryApi {
    protected static uri = "/registration/unregister/";
    public static fetch = (params: QueryParamsAuth) => super._fetch<RegistrationResponse, QueryParamsAuth>(params);
}

const generateAuthKey = (length: number, charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVQXYZ") =>
    Array.from(randomFillSync(new Uint32Array(length)))
        .map((x) => charset[x % charset.length])
        .join("");

export const Registration = {
    Info: RegistrationInfo,
    Register: RegistrationRegister,
    Unregister: RegistrationUnregister,
    generateAuthKey,
};

export interface IRegistrationInfo {
    is_registered: boolean;
    auth_key_len: number;
}
export interface RegistrationResponse {
    error: boolean;
    code: number;
}
