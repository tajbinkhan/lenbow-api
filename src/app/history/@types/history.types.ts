import {
	TransactionHistoriesSchemaType,
	TransactionHistoryActionEnum,
} from '../../../database/types';
import { TransactionReturnType } from '../../transactions/@types/transactions.types';

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

export type TransactionHistoriesReturnType = TransactionHistoriesDataType & {
	id: string;
};
