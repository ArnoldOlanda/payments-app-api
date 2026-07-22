import { CustomerInterface } from '../../interfaces/customer.interface';
import { BaseEntity } from '../../entities/base.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { Zone } from '../../zone/entities/zone.entity';
import { Account } from '../../account/entities/account.entity';

@Entity('customer')
export class Customer extends BaseEntity implements CustomerInterface {
  @Column({ type: 'varchar', length: 10, nullable: true, unique: true })
  documentNumber: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 50, nullable: true, unique: true })
  email: string;

  @ManyToOne(() => Zone, (zone) => zone.customers, { nullable: true })
  zone: Zone;

  @OneToMany(() => Account, (account) => account.customer)
  accounts: Account[];

  @CreateDateColumn({ type: 'timestamptz', select: false })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', select: false })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', select: false })
  deletedAt: Date;
}
