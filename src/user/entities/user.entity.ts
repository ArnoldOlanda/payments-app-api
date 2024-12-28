import { Zone } from "../../zone/entities/zone.entity";
import { BaseEntity } from "../../entities/base.entity";
import { UserInterface } from "../../interfaces/user.interface";
import { Role } from "../../role/entities/role.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinTable, ManyToMany, ManyToOne, UpdateDateColumn } from "typeorm";

@Entity('user')
export class User extends BaseEntity implements UserInterface{
    
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
    password: string;

    @ManyToOne(() => Role, (role) => role.users,{ eager: true })
    role: Role;

    @ManyToMany(()=> Zone,{cascade: true})
    @JoinTable()
    zones: Zone[];

    @CreateDateColumn({ select: false })
    createdAt: Date;

    @UpdateDateColumn({ select: false })
    updatedAt: Date;

    @DeleteDateColumn({ select: false })
    deletedAt: Date;
}
