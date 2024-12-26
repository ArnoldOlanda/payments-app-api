import { BaseEntity } from "../../entities/base.entity";
import { ZoneInterface } from "../../interfaces/zone.interface";
import { Column, Entity } from "typeorm";

@Entity('zone')
export class Zone extends BaseEntity implements ZoneInterface{
    @Column({type: 'varchar', length: 100})
    name: string;
}
