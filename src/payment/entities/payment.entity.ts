import { Account } from "../../account/entities/account.entity";
import { BaseEntity } from "../../entities/base.entity";
import { PaymentInterface } from "../../interfaces/payment.interface";
import { Entity, CreateDateColumn, ManyToOne, Column, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('payment')
export class Payment extends BaseEntity implements PaymentInterface{
    
    
    @Column({type: 'date'})
    date: Date;
    
    @Column({type: 'float'})
    amount: number;
    
    @ManyToOne(()=>Account, (account)=>account.payments)
    account: Account;
    
    @CreateDateColumn({ select: false })
    createdAt: Date;

    @UpdateDateColumn({ select: false })
    updatedAt: Date;

    @DeleteDateColumn({ select: false })
    deletedAt: Date;
}
