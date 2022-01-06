import { Connection, EntityManager, IDatabaseDriver } from "@mikro-orm/core";
import { randomFillSync } from "crypto";
import { Device } from "../entities/Device";
import { QueryApi, QueryParams, QueryParamsAuth, Device as DeviceAPI } from ".";

interface RegistrationParams extends QueryParams {
    body: { auth_key: string };
}

export interface RegistrationProps {
    ip: string;
    name: string;
    polling_interval: number;
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

    public static async execute(entityManager: EntityManager<IDatabaseDriver<Connection>>, props: RegistrationProps) {
        let regInfo = await Registration.Info.fetch({ ip: props.ip });

        if (regInfo.is_registered) {
            console.error("device already registered");
            throw new Error("device already registered");
        }

        let key = generateAuthKey(regInfo.auth_key_len);

        let registrationResponse = await this.fetch({
            ip: props.ip,
            body: {
                auth_key: key,
            },
        });

        if (registrationResponse.error || registrationResponse.code != 0) {
            console.error("failed to register device");
            throw new Error("failed to register device");
        }
        // if letter registration actions fail, unregister it back
        try {
            let chipInfo = await DeviceAPI.ChipInfo.fetch({
                auth_key: key,
                ip: props.ip,
            });

            let device = entityManager.create(Device, {
                name: props.name,
                ip: props.ip,
                polling_interval: props.polling_interval,
                auth_key: key,
                chip_id: chipInfo.chip_id,
                chip_model: chipInfo.chip_model,
                chip_revision: chipInfo.revision,
            });
            await entityManager.persistAndFlush(device);
            return device;
        } catch (err) {
            console.error(`postregistration process failed, unregistering`);
            console.error(err);
            await Registration.Unregister.fetch({
                ip: props.ip,
                auth_key: key,
            });
            throw new Error("postregistration process failed, unregistering");
        }
    }
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
