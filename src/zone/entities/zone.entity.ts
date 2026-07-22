import { Customer } from '../../customer/entities/customer.entity';
import { BaseEntity } from '../../entities/base.entity';
import { ZoneInterface } from '../../interfaces/zone.interface';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';

@Entity('zone')
export class Zone extends BaseEntity implements ZoneInterface {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @OneToMany(() => Customer, (customer) => customer.zone)
  customers: Customer[];

  @CreateDateColumn({ type: 'timestamptz', select: false })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', select: false })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', select: false })
  deletedAt: Date;
}
