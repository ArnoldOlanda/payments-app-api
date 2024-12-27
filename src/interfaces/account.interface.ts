import { CreditTypeInterface } from "./credit-type.interface";
import { CustomerInterface } from "./customer.interface";

export interface AccountInterface {
    id: string;
    creditType: CreditTypeInterface
    customer: CustomerInterface
    number: string
    date: Date
    dueDate: Date
    amount: number
    interest: number
    status: 'active' | 'finished' | 'cancelled' | 'overdue'
}