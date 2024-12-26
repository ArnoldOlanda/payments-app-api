import { Zone } from "../../zone/entities/zone.entity";
import { BaseEntity } from "../../entities/base.entity";
import { UserInterface } from "../../interfaces/user.interface";
import { Role } from "../../role/entities/role.entity";
import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from "typeorm";

@Entity('user')
export class User extends BaseEntity implements UserInterface{
    
    @ManyToOne(() => Role, (role) => role.users)
    @Column({ type: 'uuid' })
    role_id: string;

    @Column({
        type: 'varchar',
        length: 100,
    })
    name: string;

    @Column({
        type: 'varchar',
        length: 100,
    })
    email: string;

    @Column({
        type: 'varchar',
        length: 255,
    })
    password: string;

    @ManyToMany(()=> Zone)
    @JoinTable()
    zones: Zone[];
}
