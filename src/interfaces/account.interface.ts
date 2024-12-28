import { CreditType } from 'src/account/enums/credit-type.enum';
import { CreditTypeInterface } from './credit-type.interface';
import { CustomerInterface } from './customer.interface';

export interface AccountInterface {
  id: string;
  creditType: CreditType;
  customer: CustomerInterface;
  number: number;
  date: Date;
  dueDate: Date;
  amount: number;
  interest: number;
  status: 'active' | 'finished' | 'cancelled' | 'overdue';
}
