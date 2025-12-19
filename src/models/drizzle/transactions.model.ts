import {
	decimal,
	index,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';
import { users } from 'src/models/drizzle/auth.model';
import { transactionStatusEnum, transactionTypeEnum } from 'src/models/drizzle/enum.models';

// Contacts table
export const contacts = pgTable(
	'contacts',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		userId: serial('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 255 }).notNull(),
		phone: varchar('phone', { length: 20 }),
		email: varchar('email', { length: 255 }),
		notes: text('notes'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	table => ({
		publicIdIdx: uniqueIndex('contacts_public_id_idx').on(table.publicId),
		userIdIdx: index('contacts_user_id_idx').on(table.userId),
		userIdNameIdx: index('contacts_user_id_name_idx').on(table.userId, table.name),
	}),
);

// Transactions table
export const transactions = pgTable(
	'transactions',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		userId: serial('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		contactId: serial('contact_id')
			.notNull()
			.references(() => contacts.id, { onDelete: 'cascade' }),
		type: transactionTypeEnum('type').notNull(),
		amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
		amountPaid: decimal('amount_paid', { precision: 10, scale: 2 }).default('0.00').notNull(),
		status: transactionStatusEnum('status').default('pending').notNull(),
		description: text('description'),
		dueDate: timestamp('due_date'),
		transactionDate: timestamp('transaction_date').defaultNow().notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	table => ({
		publicIdIdx: uniqueIndex('transactions_public_id_idx').on(table.publicId),
		userIdIdx: index('transactions_user_id_idx').on(table.userId),
		contactIdIdx: index('transactions_contact_id_idx').on(table.contactId),
		userIdStatusIdx: index('transactions_user_id_status_idx').on(table.userId, table.status),
		userIdTypeIdx: index('transactions_user_id_type_idx').on(table.userId, table.type),
		statusIdx: index('transactions_status_idx').on(table.status),
		dueDateIdx: index('transactions_due_date_idx').on(table.dueDate),
		transactionDateIdx: index('transactions_transaction_date_idx').on(table.transactionDate),
	}),
);

// Payments table
export const payments = pgTable(
	'payments',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		transactionId: serial('transaction_id')
			.notNull()
			.references(() => transactions.id, { onDelete: 'cascade' }),
		amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
		paymentDate: timestamp('payment_date').defaultNow().notNull(),
		notes: text('notes'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	table => ({
		publicIdIdx: uniqueIndex('payments_public_id_idx').on(table.publicId),
		transactionIdIdx: index('payments_transaction_id_idx').on(table.transactionId),
		paymentDateIdx: index('payments_payment_date_idx').on(table.paymentDate),
	}),
);
