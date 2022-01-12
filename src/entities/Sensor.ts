import { Entity, Property, PrimaryKey, ManyToOne, OneToMany, Cascade, Collection } from "@mikro-orm/core";
import crypto from "crypto";
import { Device } from "./Device";
import { RemoteSensor } from "./RemoteSensor";

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

    @Property()
    buffer_expiration_time: number;

    // sensor address, for example rom code in ds18b20
    @Property()
    address: string;

    @Property()
    registration_date = new Date();

    @ManyToOne(() => Device)
    device!: Device;

    @OneToMany(() => RemoteSensor, (remote_sensor) => remote_sensor.sensor, { cascade: [Cascade.ALL] })
    subscribers = new Collection<RemoteSensor>(this);
}
