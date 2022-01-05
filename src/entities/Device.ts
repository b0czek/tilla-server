import { Entity, Property, PrimaryKey, OneToMany, Collection, Cascade } from "@mikro-orm/core";

import crypto from "crypto";
import { Sensor } from "./Sensor";
@Entity()
export class Device {
    @PrimaryKey()
    id!: number;

    @Property({ type: "string", unique: true })
    device_uuid: string = crypto.randomUUID();

    @Property({ type: "string" })
    name: string;

    @Property({ type: "string" })
    auth_key: string;

    @Property()
    polling_interval: number;

    @OneToMany(() => Sensor, (sensor) => sensor.device, { cascade: [Cascade.ALL] })
    sensors = new Collection<Sensor>(this);

    @Property({ type: "date" })
    registration_date = new Date();

    @Property({ type: "string" })
    device_ip: string;

    @Property({ type: "string" })
    chip_id: string;

    @Property({ type: "number" })
    chip_model: number;

    @Property({ type: "number" })
    chip_revision: number;
}
