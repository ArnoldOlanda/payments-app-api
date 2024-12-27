import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, UpdateDateColumn } from "typeorm";
import { Account } from "src/account/entities/account.entity";
import { BaseEntity } from "src/entities/base.entity";
import { CreditTypeInterface } from "src/interfaces/credit-type.interface";

@Entity('credit_type')
export class CreditType extends BaseEntity implements CreditTypeInterface {
    
    @Column({type: 'varchar', length: 100})
    name: string;

    @OneToMany(() => Account, (account) => account.creditType)
    accounts: Account[];

    @CreateDateColumn({ select: false })
    createdAt: Date;

    @UpdateDateColumn({ select: false })
    updatedAt: Date;

    @DeleteDateColumn({ select: false })
    deletedAt: Date;
}
