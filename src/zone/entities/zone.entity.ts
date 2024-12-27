import { Customer } from "src/customer/entities/customer.entity";
import { BaseEntity } from "../../entities/base.entity";
import { ZoneInterface } from "../../interfaces/zone.interface";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, UpdateDateColumn } from "typeorm";

@Entity('zone')
export class Zone extends BaseEntity implements ZoneInterface{
    @Column({type: 'varchar', length: 100})
    name: string;

    @OneToMany(()=> Customer, (customer) => customer.zone)
    customers: Customer[];

    @CreateDateColumn({ select: false })
    createdAt: Date;

    @UpdateDateColumn({ select: false })
    updatedAt: Date;

    @DeleteDateColumn({ select: false })
    deletedAt: Date;
}
