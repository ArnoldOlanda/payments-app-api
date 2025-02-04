import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany, UpdateDateColumn } from "typeorm";
import { Zone } from "../../zone/entities/zone.entity";
import { BaseEntity } from "../../entities/base.entity";
import { UserInterface } from "../../interfaces/user.interface";
import { Role } from "../../role/entities/role.entity";
import { Payment } from "../../payment/entities/payment.entity";

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

    @OneToMany(()=> Payment, (payment) => payment.user)
    payments: Payment[];

    @CreateDateColumn({ select: false })
    createdAt: Date;

    @UpdateDateColumn({ select: false })
    updatedAt: Date;

    @DeleteDateColumn({ select: false })
    deletedAt: Date;
}
