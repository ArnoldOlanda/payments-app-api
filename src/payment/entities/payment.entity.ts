import {
  Entity,
  CreateDateColumn,
  ManyToOne,
  Column,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { PaymentInterface } from '../../interfaces/payment.interface';
import { User } from '../../user/entities/user.entity';
import { Account } from '../../account/entities/account.entity';
import { BaseEntity } from '../../entities/base.entity';

@Entity('payment')
export class Payment extends BaseEntity implements PaymentInterface {
  @Column({ type: 'timestamp without time zone', nullable: true })
  date: Date;

  @Column({ type: 'float' })
  amount: number;

  @ManyToOne(() => Account, (account) => account.payments)
  account: Account;

  @ManyToOne(() => User, (user) => user.payments)
  user: User;

  @CreateDateColumn({ select: false })
  createdAt: Date;

  @UpdateDateColumn({ select: false })
  updatedAt: Date;

  @DeleteDateColumn({ select: false })
  deletedAt: Date;
}
