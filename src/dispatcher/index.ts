import { RedisClientType } from "redis";
import { MikroORM, IDatabaseDriver, Connection } from "@mikro-orm/core";
import { Device } from "../entities/Device";
import { DispatcherWorker } from "./worker";

export class Dispatcher {
    private orm: MikroORM<IDatabaseDriver<Connection>>;
    private redisClient: RedisClientType;
    public workers: DispatcherWorker[] = [];
    constructor(orm: MikroORM<IDatabaseDriver<Connection>>, redisClient: RedisClientType) {
        this.orm = orm;
        this.redisClient = redisClient;
        setImmediate(async () => this._loadWorkers);
    }

    private _loadWorkers = async () => {
        try {
            await this.orm.em.find(Device, {});
        } catch (err) {
            console.error();
        }
    };
}
