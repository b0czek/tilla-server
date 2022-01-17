import { Entity, Property, PrimaryKey, OneToMany, Collection, Cascade, ManyToOne } from "@mikro-orm/core";
import { randomUUID } from "crypto";
import { Device } from "./Device";
import { RemoteSensorField } from "./RemoteSensorField";
import { Sensor } from "./Sensor";

@Entity()
export class RemoteSensor {
    @PrimaryKey()
    id!: number;

    @Property({ unique: true, index: true })
    remote_sensor_uuid = randomUUID();

    // how often should the device sync for changes in [ms]
    @Property()
    polling_interval: number;

    // how old will the oldest sample be in [ms]
    @Property()
    max_sample_age: number;

    @OneToMany(() => RemoteSensorField, (field) => field.remote_sensor, { cascade: [Cascade.ALL], orphanRemoval: true })
    fields = new Collection<RemoteSensorField>(this);

    // device that sensor is assigned to
    @ManyToOne(() => Device)
    device!: Device;
    // sensor assigned as source
    @ManyToOne(() => Sensor)
    sensor!: Sensor;
}
