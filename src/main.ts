import { MikroORM } from "@mikro-orm/core";
import config from "./mikro-orm.config";
import express from "express";
import { apiRouter } from "./router";
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

    app.use("/api", apiRouter(orm, dispatcher));

    const port = 3000;
    app.listen(port, () => {
        console.log(`server started on ${port}`);
    });
};

main();
