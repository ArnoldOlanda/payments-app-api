import { CreditType } from 'src/account/enums/credit-type.enum';
import { CreditTypeInterface } from './credit-type.interface';
import { CustomerInterface } from './customer.interface';
import { AccountStatus } from 'src/account/enums/account-status.enum';

export interface AccountInterface {
  id: string;
  creditType: CreditType;
  customer: CustomerInterface;
  date: Date;
  dueDate: Date;
  amount: number;
  interest: number;
  remainingBalance: number;
  status: AccountStatus;
}
