import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Zone } from '../../zone/entities/zone.entity';
import { BaseEntity } from '../../entities/base.entity';
import { UserInterface } from '../../interfaces/user.interface';
import { Role } from '../../role/entities/role.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { PasswordResetToken } from '../../auth/entities/password-reset-token.entity';

@Entity('user')
export class User extends BaseEntity implements UserInterface {
  @Column({
    type: 'varchar',
    length: 100,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  email: string;

  @Column({
    type: 'varchar',
    length: 255,
    select: false,
  })
  @Exclude({ toPlainOnly: true })
  password: string;

  @ManyToOne(() => Role, (role) => role.users, { eager: true })
  role: Role;

  @ManyToMany(() => Zone, { cascade: true })
  @JoinTable()
  zones: Zone[];

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];

  @OneToMany(() => PasswordResetToken, (token) => token.user)
  passwordResetTokens: PasswordResetToken[];

  @CreateDateColumn({ type: 'timestamptz', select: false })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', select: false })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', select: false })
  deletedAt: Date;
}
