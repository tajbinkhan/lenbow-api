import { pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const transactionTypeEnum = pgEnum('transaction_type', ['lend', 'borrow']);
export const transactionStatusEnum = pgEnum('transaction_status', [
	'pending',
	'partially_paid',
	'completed',
]);
