import { MikroORM } from "@mikro-orm/core";
import ormConfig from "./mikro-orm.config";
import { Config } from "./config";
import express from "express";
import { apiRouter } from "./router";
import { Dispatcher, RedisClient } from "./dispatcher";
import { createClient } from "redis";
import { Server } from "http";

const appListen = (app: ReturnType<typeof express>, port: number) => {
    return new Promise<Server>((resolve, reject) => {
        try {
            const server = app.listen(port, () => {
                resolve(server);
            });
        } catch (err) {
            reject(err);
        }
    });
};

export const main = async (port: number) => {
    const orm = await MikroORM.init(ormConfig);
    await orm.getMigrator().up();

    const app = express();

    const redisClient: RedisClient = createClient({
        url: `redis://${Config.Redis.host}:${Config.Redis.port}/${Config.Redis.dbNumber}`,
    });
    await redisClient.connect();

    const dispatcher = new Dispatcher(orm, redisClient);
    await dispatcher.loadWorkers();

    app.use("/api", apiRouter(orm, dispatcher));

    const server = await appListen(app, port);
    // for testing purposes
    return {
        orm,
        server,
        app,
        redisClient,
        dispatcher,
    };
};

if (require.main === module) {
    main(3001);
}
