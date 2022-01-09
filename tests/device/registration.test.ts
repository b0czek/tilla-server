import request from "supertest";
import { req, uuidRegex } from "../common";
import { registrationUri, registerDevice, unregisterDevice, unregistrationUri } from "./device.common";
describe("/device/registration/register endpoint test", () => {
    it("tests /register empty body", async () => {
        const response = await req.post(registrationUri).send({});
        expect(response.statusCode).toEqual(400);
        expect(response.body.error).toEqual(true);
    });
    it("tests /register ip validation", async () => {
        const response = await req.post(registrationUri).send({
            ip: "192.265.12.2",
            name: "test",
            polling_interval: 60000,
        });
        expect(response.statusCode).toEqual(400);
        expect(response.body.error).toEqual(true);
    });
    it("tests /register name length validation", async () => {
        const response = await req.post(registrationUri).send({
            ip: "192.215.12.2",
            name: "d",
            polling_interval: 60000,
        });
        expect(response.statusCode).toEqual(400);
        expect(response.body.error).toEqual(true);
    });

    it("tests /register name type validation", async () => {
        const response = await req.post(registrationUri).send({
            ip: "192.122.12.2",
            name: 1239120,
            polling_interval: 60000,
        });
        expect(response.statusCode).toEqual(400);
        expect(response.body.error).toEqual(true);
    });
    it("tests /register ip type validation", async () => {
        const response = await req.post(registrationUri).send({
            ip: 1921682355,
            name: "test",
            polling_interval: "60000",
        });
        expect(response.statusCode).toEqual(400);
        expect(response.body.error).toEqual(true);
    });
    it("tests /register polling_interval type validation", async () => {
        const response = await req.post(registrationUri).send({
            ip: "192.122.12.2",
            name: "test",
            polling_interval: "60000",
        });
        expect(response.statusCode).toEqual(400);
        expect(response.body.error).toEqual(true);
    });
    it("tests registration process", async () => {
        const response = await registerDevice();

        expect(response.statusCode).toEqual(201);
        expect(response.body.error).toEqual(false);
        expect(uuidRegex.test(response.body.device_uuid));

        let unregResponse = await unregisterDevice(response.body.device_uuid);
        expect(unregResponse.statusCode).toEqual(200);
    });
    it("tests registration of registered device", async () => {
        const validRegistration = await registerDevice();
        expect(validRegistration.statusCode).toEqual(201);
        expect(validRegistration.body.error).toEqual(false);

        const invalidRegistration = await registerDevice();
        expect(invalidRegistration.statusCode).toEqual(503);
        expect(invalidRegistration.body.error).toEqual(true);

        let unregResponse = await unregisterDevice(validRegistration.body.device_uuid);
        expect(unregResponse.statusCode).toEqual(200);
    });
    jest.setTimeout(10000);
    it("tests (not) registration of offline device", async () => {
        const response = await registerDevice("10.100.20.200");
        expect(response.statusCode).toEqual(503);
        expect(response.body.error).toEqual(true);
    });
});
describe("/device/registration/unregister endpoint test", () => {
    it("tests empty body response", async () => {
        const response = await req.post(unregistrationUri).send({});
        expect(response.statusCode).toEqual(400);
        expect(response.body.error).toEqual(true);
    });
    it("tests non-existent device removal", async () => {
        const response = await unregisterDevice("non-existent uuid");
        expect(response.statusCode).toEqual(400);
        expect(response.body.error).toEqual(true);
    });
    it("unregistration of device", async () => {
        const registration = await registerDevice();
        expect(registration.statusCode).toEqual(201);

        const response = await unregisterDevice(registration.body.device_uuid);
        expect(response.statusCode).toEqual(200);
        expect(response.body.error).toEqual(false);
    });
});
