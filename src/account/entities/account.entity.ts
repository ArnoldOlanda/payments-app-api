import { BaseEntity } from "../../entities/base.entity";
import { AccountInterface } from "../../interfaces/account.interface";
import { CustomerInterface } from "../../interfaces/customer.interface";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, OneToMany, UpdateDateColumn } from "typeorm";
import { AccountStatus } from "../enums/account-status.enum";
import { Customer } from "../../customer/entities/customer.entity";
import { Payment } from "../../payment/entities/payment.entity";
import { CreditType } from "../enums/credit-type.enum";

@Entity('account')
export class Account extends BaseEntity implements AccountInterface{

    @ManyToOne(()=>Customer, (customer)=>customer.accounts)
    customer: CustomerInterface;

    @Column({type: 'date'})
    date: Date;

    @Column({type: 'date'})
    dueDate: Date;

    @Column({type: 'float'})
    amount: number;

    @Column({type: 'float'})
    interest: number;

    @Column({type: 'float', default: 0})
    remainingBalance: number;

    @Column({
        type: 'enum',
        enum: AccountStatus,
        default: AccountStatus.ACTIVE,
    })
    status: AccountStatus;

    @Column({
        type:'enum',
        enum: CreditType, 
        default: CreditType.DIARIO
    })
    creditType: CreditType;

    @OneToMany(()=>Payment, (payment)=>payment.account)
    payments: Payment[];

    @CreateDateColumn()
     createdAt: Date;
    
    @UpdateDateColumn({ select: false })
    updatedAt: Date;
    
    @DeleteDateColumn({ select: false })
    deletedAt: Date;
}
