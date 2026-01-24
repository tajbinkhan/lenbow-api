import {
	decimal,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';
import { CurrencyData } from '../../app/currency/@types/currency.types';
import { timestamps } from '../../database/helpers';
import { users } from './auth.model';
import { transactionHistoryActionEnum, transactionStatusEnum } from './enum.model';
import { transactions } from './transactions.model';

export const transactionHistories = pgTable(
	'transaction_histories',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		transactionId: integer('transaction_id').references(() => transactions.id, {
			onDelete: 'set null',
		}),
		transactionPublicId: text('transaction_public_id').notNull(),
		borrowerId: integer('borrower_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		lenderId: integer('lender_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		currency: jsonb('currency').$type<CurrencyData>().notNull().default({
			code: 'USD',
			name: 'US Dollar',
			symbol: '$',
		}),
		amount: decimal('amount', { precision: 10, scale: 2, mode: 'number' }).notNull(),
		amountPaid: decimal('amount_paid', { precision: 10, scale: 2, mode: 'number' })
			.notNull()
			.default(0),
		remainingAmount: decimal('remaining_amount', {
			precision: 10,
			scale: 2,
			mode: 'number',
		})
			.notNull()
			.default(0), // amount - amountPaid
		reviewAmount: decimal('review_amount', { precision: 10, scale: 2, mode: 'number' })
			.notNull()
			.default(0), // amount requested for review/repay
		status: transactionStatusEnum('status').default('pending').notNull(),
		description: text('description'),
		rejectionReason: text('rejection_reason'), // If rejected, why?
		dueDate: timestamp('due_date'), // When payment is due
		requestDate: timestamp('request_date').defaultNow().notNull(), // When request was created
		acceptedAt: timestamp('accepted_at'), // When request was accepted
		completedAt: timestamp('completed_at'), // When loan was fully paid
		rejectedAt: timestamp('rejected_at'), // When request was rejected
		action: transactionHistoryActionEnum('action').notNull(),
		occurredAt: timestamp('occurred_at').defaultNow().notNull(),
		...timestamps,
	},
	table => [
		uniqueIndex('transaction_histories_public_id_idx').on(table.publicId),
		index('transaction_histories_transaction_id_idx').on(table.transactionId),
		index('transaction_histories_borrower_id_idx').on(table.borrowerId),
		index('transaction_histories_lender_id_idx').on(table.lenderId),
		index('transaction_histories_status_idx').on(table.status),
		index('transaction_histories_action_idx').on(table.action),
		index('transaction_histories_occurred_at_idx').on(table.occurredAt),
	],
);
