import request from "supertest";
import { deviceIP } from "../common";
import { DeviceEditProps } from "../../src/router/device/device";

export const req = request.agent("http://localhost:3050");
export const registrationUri = "/api/device/register";
export const unregistrationUri = "/api/device/unregister";
export const listDevicesUri = "/api/device/list";
export const editDeviceUri = "/api/device/edit";

export const registerDevice = (deviceIp = deviceIP) =>
    req.post(registrationUri).send({
        ip: deviceIp,
        name: "test",
        polling_interval: 60000,
    });

export const unregisterDevice = (device_uuid: string) =>
    req.post(unregistrationUri).send({
        device_uuid,
    });

export const getDeviceList = () => req.get(listDevicesUri);

export const editDevice = (props: DeviceEditProps) => req.post(editDeviceUri).send(props);
