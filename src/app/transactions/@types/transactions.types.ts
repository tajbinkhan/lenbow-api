import {
	TransactionSchemaType,
	type TransactionStatusEnum,
	type TransactionTypeEnum,
} from '../../../database/types';
import { CurrencyData } from '../../currency/@types/currency.types';
import { ValidateTransactionDto, ValidateUpdateTransactionDto } from '../transactions.schema';

export type TransactionReturnType = Omit<
	TransactionSchemaType,
	'id' | 'publicId' | 'createdAt' | 'updatedAt'
> & {
	id: string;
};

export interface TransactionListReturnType {
	id: string;
	publicId: string;
	borrower: {
		id: string;
		name: string | null;
		email: string;
		image: string | null;
	};
	lender: {
		id: string;
		name: string | null;
		email: string;
		image: string | null;
	};
	type: TransactionTypeEnum;
	currency: CurrencyData;
	amount: number;
	amountPaid: number;
	remainingAmount: number;
	reviewAmount: number | null;
	rejectionReason: string | null;
	requestDate: Date | null;
	acceptedAt: Date | null;
	completedAt: Date | null;
	rejectedAt: Date | null;
	status: TransactionStatusEnum;
	description: string | null;
	dueDate: Date | null;
	createdAt: Date;
	updatedAt: Date;
	createdBy: string;
}

export interface TransactionEligibilityForDeletion {
	ineligibleTransactions: number[];
	eligibleTransactions: number[];
}

export type ValidateTransactionDtoWithCurrency = Omit<ValidateTransactionDto, 'currency'> & {
	currency: CurrencyData;
};

export type ValidateUpdateTransactionDtoWithCurrency = Omit<
	ValidateUpdateTransactionDto,
	'currency'
> & {
	currency: CurrencyData;
	updatedBy?: number;
};
