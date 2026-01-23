import { index, pgTable, serial, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from '../../database/helpers';

// Currency table
export const currencies = pgTable(
	'currencies',
	{
		id: serial('id').primaryKey(),
		code: varchar('code', { length: 3 }).notNull().unique(), // USD, EUR, INR, etc.
		name: varchar('name', { length: 100 }).notNull(), // US Dollar, Euro, Indian Rupee
		symbol: varchar('symbol', { length: 10 }).notNull(), // $, €, ₹
		...timestamps,
	},
	table => [index('currencies_code_idx').on(table.code)],
);
