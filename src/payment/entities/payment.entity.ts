import {
  Entity,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
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
  @Column({ type: 'timestamp with time zone', nullable: false })
  date: Date;

  @Column({ type: 'float' })
  amount: number;

  @Column({ type: 'float' })
  appliedAmount: number;

  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, (account) => account.payments, {
    nullable: false,
  })
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, (user) => user.payments, {
    nullable: true,
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz', select: false })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', select: false })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', select: false })
  deletedAt: Date;
}
