import type { InferSelectModel } from 'drizzle-orm';
import { accounts, sessions, users } from '../models/drizzle/auth.model';
import { currencies } from '../models/drizzle/currency.model';
import {
	transactionHistoryActionEnum,
	transactionStatusEnum,
	transactionTypeEnum,
} from '../models/drizzle/enum.model';
import { transactionHistories, transactionOldHistories } from '../models/drizzle/history.model';
import { transactions, type contacts } from '../models/drizzle/transactions.model';

export type UserSchemaType = InferSelectModel<typeof users>;
export type AccountSchemaType = InferSelectModel<typeof accounts>;
export type SessionSchemaType = InferSelectModel<typeof sessions>;
export type TransactionSchemaType = InferSelectModel<typeof transactions>;
export type ContactSchemaType = InferSelectModel<typeof contacts>;
export type TransactionOldHistoriesSchemaType = InferSelectModel<typeof transactionOldHistories>;
export type TransactionHistoriesSchemaType = InferSelectModel<typeof transactionHistories>;
export type CurrencySchemaType = InferSelectModel<typeof currencies>;

/**
 * Enum Schema Types
 */
export type TransactionTypeEnum = (typeof transactionTypeEnum.enumValues)[number];
export type TransactionStatusEnum = (typeof transactionStatusEnum.enumValues)[number];
export type TransactionHistoryActionEnum = (typeof transactionHistoryActionEnum.enumValues)[number];
