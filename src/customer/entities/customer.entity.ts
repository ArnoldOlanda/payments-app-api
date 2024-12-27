import { CustomerInterface } from 'src/interfaces/customer.interface';
import { BaseEntity } from '../../entities/base.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { Zone } from 'src/zone/entities/zone.entity';

@Entity('customer')
export class Customer extends BaseEntity implements CustomerInterface {

    @Column({ type: 'varchar', length: 10 })
    documentNumber: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'varchar', length: 100 })
    lastName: string;

    @Column({ type: 'varchar', length: 100 })
    address: string;

    @Column({ type: 'varchar', length: 15 })
    phone: string;

    @Column({ type: 'varchar', length: 50 })
    email: string;

    @ManyToOne(() => Zone, (zone) => zone.customers)
    zone: Zone;

    @CreateDateColumn({ select: false })
    createdAt: Date;

    @UpdateDateColumn({ select: false })
    updatedAt: Date;

    @DeleteDateColumn({ select: false })
    deletedAt: Date;
}
