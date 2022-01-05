import { RedisClientType, createClient } from "redis";
import { MikroORM, IDatabaseDriver, Connection } from "@mikro-orm/core";
import { Device } from "../entities/Device";
import { DispatcherWorker } from "./worker";

export type RedisClient = ReturnType<typeof createClient>;

export class Dispatcher {
    private orm: MikroORM<IDatabaseDriver<Connection>>;
    private redisClient: RedisClient;
    public workers: DispatcherWorker[] = [];
    constructor(orm: MikroORM<IDatabaseDriver<Connection>>, redisClient: RedisClient) {
        this.orm = orm;
        this.redisClient = redisClient;
    }

    public loadWorkers = async () => {
        try {
            let devices = await this.orm.em.find(Device, {});
            for (let device of devices) {
                console.log(`dispatching worker for device ${device.name}`);
                await device.sensors.init();
                this.workers.push(new DispatcherWorker(device, this.redisClient));
            }
        } catch (err) {
            console.error(err);
        }
    };
}

export * from "./worker";
