import { BaseEntity } from '../../entities/base.entity';
import { RoleInterface } from '../../interfaces/role.interface';
import { User } from '../../user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';

@Entity('role')
export class Role extends BaseEntity implements RoleInterface {
  @Column({
    type: 'varchar',
    length: 100,
  })
  name: string;

  @OneToMany(() => User, (user) => user.role)
  users: User[];

  @CreateDateColumn({ select: false })
  createdAt: Date;

  @UpdateDateColumn({ select: false })
  updatedAt: Date;

  @DeleteDateColumn({ select: false })
  deletedAt: Date;
}
