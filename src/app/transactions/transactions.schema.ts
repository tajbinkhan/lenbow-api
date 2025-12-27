import { baseQuerySchema, type SortableField } from 'src/core/validators/baseQuery.schema';
import {
	validateArray,
	validateDate,
	validateEnum,
	validatePositiveNumber,
	validateString,
	validateUUID,
} from 'src/core/validators/commonRules';
import { transactionStatusEnum, transactionTypeEnum } from 'src/models/drizzle/enum.models';
import z from 'zod';

const TRANSACTION_SORTABLE_FIELDS: readonly SortableField[] = [
	{ name: 'id', queryName: 'id' },
	{ name: 'createdAt', queryName: 'createdAt' },
] as const;

export const transactionQuerySchema = baseQuerySchema(TRANSACTION_SORTABLE_FIELDS).extend({
	type: validateString('Type')
		.transform(val => {
			if (!val?.trim()) return [];
			return val
				.split(',')
				.map(v => v.trim())
				.filter(Boolean)
				.map(v => validateEnum('Type', transactionTypeEnum.enumValues).parse(v));
		})
		.optional(),
	status: validateString('Status')
		.transform(val => {
			if (!val?.trim()) return [];
			return val
				.split(',')
				.map(v => v.trim())
				.filter(Boolean)
				.map(v => validateEnum('Status', transactionStatusEnum.enumValues).parse(v));
		})
		.optional(),
});

export const validateTransactionSchema = z.object({
	borrowerId: validatePositiveNumber('Borrower ID'),
	requesterId: validatePositiveNumber('Requester ID'),
	type: validateEnum('Transaction Type', transactionTypeEnum.enumValues),
	amount: validatePositiveNumber('Amount'),
	amountPaid: validatePositiveNumber('Amount Paid').optional(),
	status: validateEnum('Transaction Status', transactionStatusEnum.enumValues),
	description: validateString('Description').optional(),
	dueDate: validateDate('Due Date').optional(),
});

export const validateUpdateTransactionSchema = validateTransactionSchema.omit({
	borrowerId: true,
	requesterId: true,
});

export const validateDeleteTransactionSchema = z.object({
	transactionIds: validateArray('Transaction IDs', validateUUID('Transaction ID')),
});

export type TransactionQuerySchemaType = z.infer<typeof transactionQuerySchema>;
export type ValidateTransactionDto = z.infer<typeof validateTransactionSchema>;
export type ValidateUpdateTransactionDto = z.infer<typeof validateUpdateTransactionSchema>;
export type ValidateDeleteTransactionDto = z.infer<typeof validateDeleteTransactionSchema>;
