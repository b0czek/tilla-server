import { MikroORM } from "@mikro-orm/core";
import config from "./mikro-orm.config";
import { register } from "./dispatcher/register";
import express from "express";
import { apiRouter } from "./router";
import { Device } from "./entities/Device";
import { DispatcherWorker } from "./dispatcher/worker";

const main = async () => {
    let orm = await MikroORM.init(config);
    await orm.getMigrator().up();

    const app = express();

    let sensors = await orm.em.find(Device, {});
    let workers = await Promise.all(
        sensors.map(async (device) => {
            await device.sensors.init();
            return new DispatcherWorker(device);
        })
    );

    app.use("/api", apiRouter(orm, workers));

    const port = 3000;
    app.listen(port, () => {
        console.log(`server started on ${port}`);
    });
};

main();
