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
        // query all devices from db
        let devices = await this.orm.em.find(Device, {});
        for (let device of devices) {
            console.log(`dispatching worker for device ${device.name}`);
            // initialize sensors for every device
            await device.sensors.init();
            // and create a worker for it
            this.workers.push(new DispatcherWorker(device, this.redisClient));
        }
    };

    public close() {
        this.workers.forEach((worker) => worker.stop());
    }

    public findWorker = (device_uuid: string) => this.workers.find((worker) => worker.uuid == device_uuid);

    /**
     * reload the worker, or create new one if there isn't one already
     * @param device_uuid uuid of device's worker to be reloaded
     */
    public async reloadWorker(device_uuid: string) {
        // search for given device in db
        let device = await this.orm.em.findOne(Device, {
            device_uuid: device_uuid,
        });
        // check if it exists
        if (!device) {
            throw new Error("no device with given uuid found");
        }
        // initialize its sensors
        await device.sensors.init();
        // search for a worker
        let idx = this.workers.findIndex((device) => device.uuid == device_uuid);
        // if there is one
        if (idx !== -1) {
            // stop it
            this.workers[idx].stop();
            // and remove from workers
            this.workers.splice(idx, 1);
        }
        // create new worker and add it to array
        this.workers.push(new DispatcherWorker(device, this.redisClient));
    }
    /**
     * function removing worker from the worker pool
     * @param device_uuid uuid of device's worker to be removed
     * @param options removal options
     */
    public async removeWorker(device_uuid: string, options: RemoveWorkerOptions = { removeRedisHistory: false }) {
        let idx = this.workers.findIndex((device) => device.uuid == device_uuid);
        if (idx == -1) {
            throw new Error("no worker with given device uuid found");
        }
        let worker = this.workers[idx];
        worker.stop();

        // if specified, remove all sensor history from redis
        if (options.removeRedisHistory && worker.sensorsData.length > 0) {
            await this.redisClient.del(worker.sensorsData.map((data) => data.sensor.sensor_uuid));
        }

        this.workers.splice(idx, 1);
    }
}

export interface RemoveWorkerOptions {
    removeRedisHistory: boolean;
}

export * from "./worker";
