import {
	TransactionSchemaType,
	type TransactionStatusEnum,
	type TransactionTypeEnum,
} from 'src/database/types';

export type TransactionReturnType = Omit<
	TransactionSchemaType,
	'id' | 'publicId' | 'createdAt' | 'updatedAt'
> & {
	id: string;
};

export interface TransactionListReturnType {
	id: string;
	publicId: string;
	contact: {
		id: string;
		name: string | null;
		email: string;
		image: string | null;
	} | null;
	type: TransactionTypeEnum;
	amount: number;
	amountPaid: number;
	status: TransactionStatusEnum;
	description: string | null;
	dueDate: Date | null;
	createdAt: Date;
	updatedAt: Date;
}
