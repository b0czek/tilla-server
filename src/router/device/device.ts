import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import express from "express";
import { helper } from "..";
import { Device } from "../../entities/Device";

export const deviceEndpoints = (orm: MikroORM<IDatabaseDriver<Connection>>) => {
    const router = express.Router();

    router.get("/list", async (req, res) => {
        try {
            let devices = await orm.em.find(Device, {});

            let omitted = helper.omitFields(devices, ["id", "sensors", "auth_key"] as const);
            res.json({
                error: false,
                devices: omitted,
            });
        } catch (err) {
            helper.error(500, res, "could not fetch device list");
        }
    });
    return router;
};
