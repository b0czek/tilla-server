import { ISensorsInfo } from "../../src/api";
import { registerDevice, unregisterDevice } from "../device/device.common";
import { listDevices } from "./sensors.common";

describe("Test /sensors/list endpoint", () => {
    it("responds properly", async () => {
        const registration = await registerDevice();
        expect(registration.statusCode).toEqual(201);

        const response = await listDevices(registration.body.device_uuid);
        expect(response.statusCode).toEqual(200);
        let { error, ...sensors } = response.body;
        expect(error).toEqual(false);

        Object.entries(<ISensorsInfo>sensors).forEach(([key, value]) => {
            expect(value.error).toEqual(0);
            Object.entries(value.sensors).forEach(([key, value]) => {
                expect(value.error).toEqual(0);
            });
        });

        await unregisterDevice(registration.body.device_uuid);
    });
});
