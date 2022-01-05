import { MikroORM } from "@mikro-orm/core";
import config from "./mikro-orm.config";
import { register } from "./dispatcher/register";
import express from "express";
import { apiRouter } from "./router";
import { Device } from "./entities/Device";
import { Dispatcher, RedisClient } from "./dispatcher";
import { createClient } from "redis";

const main = async () => {
    let orm = await MikroORM.init(config);
    await orm.getMigrator().up();

    const app = express();

    const redisClient: RedisClient = createClient();
    await redisClient.connect();

    const dispatcher = new Dispatcher(orm, redisClient);
    await dispatcher.loadWorkers();

    // let workers = await Promise.all(
    //     sensors.map(async (device) => {
    //         await device.sensors.init();
    //         return new DispatcherWorker(device);
    //     })
    // );

    app.use("/api", apiRouter(orm, dispatcher));

    const port = 3000;
    app.listen(port, () => {
        console.log(`server started on ${port}`);
    });
};

main();
