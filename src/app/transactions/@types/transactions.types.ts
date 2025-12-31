import {
	TransactionSchemaType,
	type TransactionStatusEnum,
	type TransactionTypeEnum,
} from '../../../database/types';

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
	amount: number;
	amountPaid: number;
	remainingAmount: number;
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
}

export interface TransactionEligibilityForDeletion {
	ineligibleTransactions: number[];
	eligibleTransactions: number[];
}
