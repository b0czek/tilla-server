import { Connection, EntityManager, IDatabaseDriver, NotFoundError } from "@mikro-orm/core";

import { Device } from "../entities/Device";

import { Registration, Device as DeviceAPI } from "../api";

type EM = EntityManager<IDatabaseDriver<Connection>>;

export interface RegistrationProps {
    ip: string;
    name: string;
    polling_interval: number;
}

export const register = async (em: EM, props: RegistrationProps) => {
    let regInfo = await Registration.Info.fetch({ ip: props.ip });

    if (regInfo.is_registered) {
        console.error("device already registered");
        throw new Error("device already registered");
    }

    let key = Registration.generateAuthKey(regInfo.auth_key_len);

    let registrationResponse = await Registration.Register.fetch({
        ip: props.ip,
        body: {
            auth_key: key,
        },
    });

    if (registrationResponse.error || registrationResponse.code != 0) {
        console.error("failed to register device");
        throw new Error("failed to register device");
    }
    // if registration of the latter actions fail, unregister it back
    try {
        let chipInfo = await DeviceAPI.ChipInfo.fetch({
            auth_key: key,
            ip: props.ip,
        });

        let device = em.create(Device, {
            name: props.name,
            device_ip: props.ip,
            polling_interval: props.polling_interval,
            auth_key: key,
            chip_id: chipInfo.chip_id,
            chip_model: chipInfo.chip_model,
            chip_revision: chipInfo.revision,
        });
        await em.persistAndFlush(device);
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
};
