import {
	decimal,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from 'src/database/helpers';
import { users } from 'src/models/drizzle/auth.model';
import { transactionStatusEnum, transactionTypeEnum } from 'src/models/drizzle/enum.models';

// Contacts table
export const contacts = pgTable(
	'contacts',
	{
		id: serial('id').primaryKey(),
		borrowerId: integer('borrower_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		requesterId: integer('requester_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		...timestamps,
	},
	table => [
		uniqueIndex('contacts_borrower_requester_idx').on(table.borrowerId, table.requesterId),
		index('contacts_borrower_id_idx').on(table.borrowerId),
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
		requesterId: integer('requester_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: transactionTypeEnum('type').notNull(),
		amount: decimal('amount', { precision: 10, scale: 2, mode: 'number' }).notNull(),
		amountPaid: decimal('amount_paid', { precision: 10, scale: 2, mode: 'number' })
			.default(0)
			.notNull(),
		status: transactionStatusEnum('status').default('pending').notNull(),
		description: text('description'),
		dueDate: timestamp('due_date'),
		transactionDate: timestamp('transaction_date').defaultNow().notNull(),
		...timestamps,
	},
	table => [
		uniqueIndex('transactions_public_id_idx').on(table.publicId),
		index('transactions_borrower_id_idx').on(table.borrowerId),
		index('transactions_requester_id_idx').on(table.requesterId),
		index('transactions_borrower_id_status_idx').on(table.borrowerId, table.status),
		index('transactions_borrower_id_type_idx').on(table.borrowerId, table.type),
		index('transactions_status_idx').on(table.status),
		index('transactions_due_date_idx').on(table.dueDate),
		index('transactions_transaction_date_idx').on(table.transactionDate),
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
