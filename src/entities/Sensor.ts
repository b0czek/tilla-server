import { Entity, Property, PrimaryKey, ManyToOne } from "@mikro-orm/core";
import crypto from "crypto";
import { Device } from "./Device";

@Entity()
export class Sensor {
    @PrimaryKey()
    id!: number;

    @Property({ unique: true })
    sensor_uuid: string = crypto.randomUUID();

    @Property()
    type: string;

    @Property()
    name: string;

    // sensor address, for example rom code in ds18b20
    @Property()
    address: string;

    @Property()
    registration_date = new Date();

    @ManyToOne(() => Device)
    device!: Device;
}
