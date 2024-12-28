import { Account } from "src/account/entities/account.entity";

export interface PaymentInterface {
    id: string;
    account: Account;
    date: Date;
    amount: number;
}