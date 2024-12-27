import { BaseEntity } from "src/entities/base.entity";
import { AccountInterface } from "src/interfaces/account.interface";
import { CreditTypeInterface } from "src/interfaces/credit-type.interface";
import { CustomerInterface } from "src/interfaces/customer.interface";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, UpdateDateColumn } from "typeorm";
import { AccountStatus } from "../enums/account-status.enum";
import { CreditType } from "src/credit-type/entities/credit-type.entity";
import { Customer } from "src/customer/entities/customer.entity";

@Entity('account')
export class Account extends BaseEntity implements AccountInterface{

    @ManyToOne(()=>CreditType, (creditType)=>creditType.accounts)
    creditType: CreditTypeInterface;

    @ManyToOne(()=>Customer, (customer)=>customer.accounts)
    customer: CustomerInterface;

    @Column({type: 'varchar', length: 10})
    number: string;

    @Column({type: 'date'})
    date: Date;

    @Column({type: 'date'})
    dueDate: Date;

    @Column({type: 'float'})
    amount: number;

    @Column({type: 'float'})
    interest: number;

    @Column({
        type: 'enum',
        enum: Object.values(AccountStatus),
        default: 'active',
    })
    status: AccountStatus;

    @CreateDateColumn({ select: false })
        createdAt: Date;
    
    @UpdateDateColumn({ select: false })
    updatedAt: Date;
    
    @DeleteDateColumn({ select: false })
    deletedAt: Date;
}
