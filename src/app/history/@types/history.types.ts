import {
	TransactionHistoriesSchemaType,
	TransactionHistoryActionEnum,
	TransactionOldHistoriesSchemaType,
} from '../../../database/types';
import { TransactionReturnType } from '../../transactions/@types/transactions.types';

export type TransactionOldHistoriesDataType = Omit<
	TransactionOldHistoriesSchemaType,
	'id' | 'publicId' | 'createdAt' | 'updatedAt'
>;

export interface TransactionHistoriesDataType {
	transactionId: number | null;
	action: TransactionHistoryActionEnum;
	details: TransactionReturnType;
	occurredAt: Date;
}

export type TransactionHistoryDataEntryType = Omit<
	TransactionHistoriesSchemaType,
	'id' | 'publicId' | 'createdAt' | 'updatedAt'
>;

export type TransactionOldHistoriesReturnType = TransactionOldHistoriesDataType & {
	id: string;
};

export type TransactionHistoriesReturnType = TransactionHistoriesDataType & {
	id: string;
};
