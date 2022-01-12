import { DeviceEditProps } from "../../src/router/device/device";
import { deviceIP, req } from "../common";
import { editDevice, editDeviceUri, getDeviceList, registerDevice, unregisterDevice } from "./device.common";

describe("/device/list endpoint test", () => {
    it("responds properly", async () => {
        const response = await getDeviceList();

        expect(response.statusCode).toEqual(200);
        expect(response.body.error).toEqual(false);
        expect(Array.isArray(response.body.devices)).toEqual(true);
    });

    it("does not leak data", async () => {
        const registration = await registerDevice();

        const response = await getDeviceList();
        expect(response.statusCode).toEqual(200);
        for (let device of response.body.devices) {
            expect(device.auth_key).toBeUndefined();
            expect(device.sensors).toBeUndefined();
            expect(device.remote_sensors).toBeUndefined();
            expect(device.id).toBeUndefined();
        }
        await unregisterDevice(registration.body.device_uuid);
    });
});

const getEditProps = (uuid: string): DeviceEditProps => {
    return {
        device_uuid: uuid,
        ip: deviceIP,
        name: "test",
        polling_interval: 60000,
    };
};

describe("/device/edit endpoint test", () => {
    it("requires all fields", async () => {
        const registration = await registerDevice();
        expect(registration.statusCode).toEqual(201);
        const editProps = getEditProps(registration.body.device_uuid);
        //empty, 1, 2 ,3 fields
        for (let i = 0; i < Object.keys(editProps).length; i++) {
            let props = Object.fromEntries(Object.entries(editProps).slice(0, i));
            const response = await req.post(editDeviceUri).send(props);

            expect(response.statusCode).toEqual(400);
            expect(response.body.error).toEqual(true);
        }
        await unregisterDevice(registration.body.device_uuid);
    });

    it("does not allow inexistent device", async () => {
        const editProps = getEditProps("non-existent uuid");
        const response = await editDevice(editProps);

        expect(response.statusCode).toEqual(400);
        expect(response.body.error).toEqual(true);
    });

    it("propagates changes", async () => {
        const registration = await registerDevice();
        expect(registration.statusCode).toEqual(201);

        const newName = "test2";
        const editProps = getEditProps(registration.body.device_uuid);
        editProps.name = newName;

        const response = await editDevice(editProps);

        expect(response.statusCode).toEqual(200);
        expect(response.body).toEqual({
            error: false,
            changedFields: {
                name: newName,
            },
        });

        const listResponse = await getDeviceList();
        expect(listResponse.statusCode).toEqual(200);
        expect(listResponse.body.devices?.length > 0).toEqual(true);

        let device = listResponse.body.devices.find(
            (device: any) => device.device_uuid === registration.body.device_uuid
        );

        expect(device).not.toBeUndefined();
        expect(device.name).toEqual(newName);

        await unregisterDevice(registration.body.device_uuid);
    });
});
