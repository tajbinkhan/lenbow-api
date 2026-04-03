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
import { transactionStatusEnum, transactionTypeEnum } from '../../models/drizzle/enum.model';

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
	type: validateEnum('Type', transactionTypeEnum.enumValues).optional(),
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

export const requestTransactionQuerySchema = baseQuerySchema(TRANSACTION_SORTABLE_FIELDS).extend({
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

// Schema for incoming transaction creation request
export const validateIncomingTransactionSchema = z.object({
	type: validateEnum('Transaction Type', transactionTypeEnum.enumValues),
	contactId: validateUUID('Contact ID'),
	amount: validatePositiveNumber('Amount'),
	currency: validateString('Currency Code'),
	description: validateString('Description').optional(),
	dueDate: validateDate('Due Date').optional(),
});

// Internal schema with full transaction details
export const validateTransactionSchema = z.object({
	borrowerId: validatePositiveNumber('Borrower ID'),
	lenderId: validatePositiveNumber('Lender ID'),
	amount: validatePositiveNumber('Amount'),
	amountPaid: validatePositiveNumber('Amount Paid').optional(),
	remainingAmount: validatePositiveNumber('Remaining Amount').optional(),
	status: validateEnum('Transaction Status', transactionStatusEnum.enumValues),
	currency: validateString('Currency Code'),
	description: validateString('Description').optional(),
	rejectionReason: validateString('Rejection Reason').optional(),
	dueDate: validateDate('Due Date').optional(),
	requestDate: validateDate('Request Date').optional(),
	acceptedAt: validateDate('Accepted At').optional(),
	completedAt: validateDate('Completed At').optional(),
	rejectedAt: validateDate('Rejected At').optional(),
	createdBy: validatePositiveNumber('Created By'),
});

const updateRejectedTransactionSchema = z.object({
	rejectionReason: validateString('Rejection Reason').optional(),
});

const updateRequestedRepayTransactionSchema = z.object({
	reviewAmount: validatePositiveNumber('Review Amount'),
});

export const validateLenderRepaymentSchema = z.object({
	amount: validatePositiveNumber('Amount'),
});

export const validateUpdateStatusTransactionSchema = z.discriminatedUnion('status', [
	updateRejectedTransactionSchema.extend({
		status: z.literal('rejected'),
	}),
	updateRequestedRepayTransactionSchema.extend({
		status: z.literal('requested_repay'),
	}),
	z.object({
		status: validateEnum('Transaction Status', [
			'pending',
			'accepted',
			'partially_paid',
			'completed',
		]),
	}),
]);

export const validateUpdateTransactionSchema = z.object({
	amount: validatePositiveNumber('Amount'),
	currency: validateString('Currency Code'),
	dueDate: validateDate('Due Date').optional(),
});

export const validateDeleteTransactionSchema = z.object({
	transactionIds: validateArray('Transaction IDs', validateUUID('Transaction ID')),
});

export type TransactionQuerySchemaType = z.infer<typeof transactionQuerySchema>;
export type RequestTransactionQuerySchemaType = z.infer<typeof requestTransactionQuerySchema>;
export type ValidateIncomingTransactionDto = z.infer<typeof validateIncomingTransactionSchema>;
export type ValidateTransactionDto = z.infer<typeof validateTransactionSchema>;
export type ValidateUpdateStatusTransactionDto = z.infer<
	typeof validateUpdateStatusTransactionSchema
>;
export type ValidateLenderRepaymentDto = z.infer<typeof validateLenderRepaymentSchema>;
export type ValidateUpdateTransactionDto = z.infer<typeof validateUpdateTransactionSchema>;
export type ValidateDeleteTransactionDto = z.infer<typeof validateDeleteTransactionSchema>;
