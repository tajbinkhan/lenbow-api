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
import { transactionStatusEnum } from './enum.model';

// Contacts table
export const contacts = pgTable(
	'contacts',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		requestedUserId: integer('requested_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		connectedUserId: integer('connected_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		...timestamps,
	},
	table => [
		uniqueIndex('contacts_requested_connected_idx').on(
			table.requestedUserId,
			table.connectedUserId,
		),
		index('contacts_requested_user_id_idx').on(table.requestedUserId),
	],
);

// Transactions table
export const transactions = pgTable(
	'transactions',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
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

		// Transaction created by
		createdBy: integer('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		...timestamps,
	},
	table => [
		uniqueIndex('transactions_public_id_idx').on(table.publicId),
		index('transactions_borrower_id_idx').on(table.borrowerId),
		index('transactions_lender_id_idx').on(table.lenderId),
		index('transactions_borrower_id_status_idx').on(table.borrowerId, table.status),
		index('transactions_lender_id_status_idx').on(table.lenderId, table.status),
		index('transactions_status_idx').on(table.status),
		index('transactions_due_date_idx').on(table.dueDate),
		index('transactions_due_date_status_idx').on(table.dueDate, table.status),
	],
);

// Payments table
export const payments = pgTable(
	'payments',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		transactionId: integer('transaction_id')
			.notNull()
			.references(() => transactions.id, { onDelete: 'cascade' }),
		amount: decimal('amount', { precision: 10, scale: 2, mode: 'number' }).notNull(),
		paymentDate: timestamp('payment_date').defaultNow().notNull(),
		notes: text('notes'),
		...timestamps,
	},
	table => [
		uniqueIndex('payments_public_id_idx').on(table.publicId),
		index('payments_transaction_id_idx').on(table.transactionId),
		index('payments_payment_date_idx').on(table.paymentDate),
	],
);
