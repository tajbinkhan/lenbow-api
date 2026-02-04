// In your schema file
import { relations } from 'drizzle-orm';
import { users } from './auth.model';
import { transactionHistories } from './history.model';
import { contacts, transactions } from './transactions.model';

export const usersRelations = relations(users, ({ many }) => ({
	requestedContacts: many(contacts, { relationName: 'requested' }),
	connectedContacts: many(contacts, { relationName: 'connected' }),
	borrowerHistories: many(transactionHistories, { relationName: 'borrowerHistories' }),
	lenderHistories: many(transactionHistories, { relationName: 'lenderHistories' }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
	requestedUser: one(users, {
		fields: [contacts.requestedUserId],
		references: [users.id],
		relationName: 'requested',
	}),
	connectedUser: one(users, {
		fields: [contacts.connectedUserId],
		references: [users.id],
		relationName: 'connected',
	}),
}));

export const transactionsRelations = relations(transactions, ({ many }) => ({
	histories: many(transactionHistories),
}));

export const transactionHistoriesRelations = relations(transactionHistories, ({ one }) => ({
	transaction: one(transactions, {
		fields: [transactionHistories.transactionId],
		references: [transactions.id],
	}),
	borrower: one(users, {
		fields: [transactionHistories.borrowerId],
		references: [users.id],
		relationName: 'borrowerHistories',
	}),
	lender: one(users, {
		fields: [transactionHistories.lenderId],
		references: [users.id],
		relationName: 'lenderHistories',
	}),
}));
