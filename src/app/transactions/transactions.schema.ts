import z from 'zod';
import { baseQuerySchema, type SortableField } from '../../core/validators/baseQuery.schema';
import {
	validateArray,
	validateDate,
	validateEnum,
	validatePositiveNumber,
	validateString,
	validateUUID,
} from '../../core/validators/commonRules';
import { transactionStatusEnum, transactionTypeEnum } from '../../models/drizzle/enum.models';

const TRANSACTION_SORTABLE_FIELDS: readonly SortableField[] = [
	{ name: 'id', queryName: 'id' },
	{ name: 'name', queryName: 'name' },
	{ name: 'email', queryName: 'email' },
	{ name: 'amount', queryName: 'amount' },
	{ name: 'status', queryName: 'status' },
	{ name: 'type', queryName: 'type' },
	{ name: 'requestDate', queryName: 'requestDate' },
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
	lenderId: validatePositiveNumber('Lender ID'),
	amount: validatePositiveNumber('Amount'),
	amountPaid: validatePositiveNumber('Amount Paid').optional(),
	remainingAmount: validatePositiveNumber('Remaining Amount').optional(),
	status: validateEnum('Transaction Status', transactionStatusEnum.enumValues),
	description: validateString('Description').optional(),
	rejectionReason: validateString('Rejection Reason').optional(),
	dueDate: validateDate('Due Date').optional(),
	requestDate: validateDate('Request Date').optional(),
	acceptedAt: validateDate('Accepted At').optional(),
	completedAt: validateDate('Completed At').optional(),
	rejectedAt: validateDate('Rejected At').optional(),
});

export const validateUpdateTransactionSchema = z.object({
	amount: validatePositiveNumber('Amount'),
	dueDate: validateDate('Due Date').optional(),
});

export const validateRejectTransactionSchema = z.object({
	rejectionReason: validateString('Rejection Reason').optional(),
});

export const validateDeleteTransactionSchema = z.object({
	transactionIds: validateArray('Transaction IDs', validateUUID('Transaction ID')),
});

export type TransactionQuerySchemaType = z.infer<typeof transactionQuerySchema>;
export type ValidateTransactionDto = z.infer<typeof validateTransactionSchema>;
export type ValidateUpdateTransactionDto = z.infer<typeof validateUpdateTransactionSchema>;
export type ValidateRejectTransactionDto = z.infer<typeof validateRejectTransactionSchema>;
export type ValidateDeleteTransactionDto = z.infer<typeof validateDeleteTransactionSchema>;
