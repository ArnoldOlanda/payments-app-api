import { BaseEntity } from "../../entities/base.entity";
import { RoleInterface } from "../../interfaces/role.interface";
import { User } from "../../user/entities/user.entity";
import { Column, Entity, OneToMany } from "typeorm";

@Entity('role')
export class Role extends BaseEntity implements RoleInterface{
    @Column({
        type: 'varchar',
        length: 100,
    })
    name: string;

    @Column({
        type: 'varchar',
        length: 100,
    })
    description: string;

    @OneToMany(() => User, (user) => user.role_id)
    users: User[];
}
