import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
	aliasedTable,
	and,
	count,
	eq,
	exists,
	gte,
	ilike,
	inArray,
	lte,
	ne,
	or,
	sql,
	type SQL,
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PaginatedResponse } from '../../core/api-response.interceptor';
import PaginationManager from '../../core/pagination';
import { DATABASE_CONNECTION } from '../../database/connection';
import { orderByColumn } from '../../database/helpers';
import schema from '../../database/schema';
import DrizzleService from '../../database/service';
import {
	TransactionSchemaType,
	TransactionStatusEnum,
	type TransactionTypeEnum,
} from '../../database/types';
import type {
	TransactionEligibilityForDeletion,
	TransactionListReturnType,
	ValidateTransactionDtoWithCurrency,
	ValidateUpdateTransactionDtoWithCurrency,
} from './@types/transactions.types';
import {
	RequestTransactionQuerySchemaType,
	type TransactionQuerySchemaType,
} from './transactions.schema';

@Injectable()
export class TransactionsService extends DrizzleService {
	constructor(
		@Inject(DATABASE_CONNECTION)
		db: NodePgDatabase<typeof schema>,
	) {
		super(db);
	}

	async createTransaction(
		data: Omit<ValidateTransactionDtoWithCurrency, 'type'>,
	): Promise<TransactionSchemaType> {
		const modifiedData = { ...data, remainingAmount: data.amount };

		const newTransaction = await this.getDb()
			.insert(schema.transactions)
			.values(modifiedData)
			.returning()
			.then(res => res[0]);

		return newTransaction;
	}

	async getTransactionList(
		filter: TransactionQuerySchemaType,
		currentUserId: number,
	): Promise<PaginatedResponse<TransactionListReturnType>> {
		// Create date objects from string inputs if they exist
		const fromDate = filter.from ? new Date(filter.from) : undefined;
		const toDate = filter.to ? new Date(filter.to) : undefined;

		// If toDate exists, set it to the end of the day
		if (toDate) {
			toDate.setHours(23, 59, 59, 999);
		}

		const q = filter.search ? `%${filter.search}%` : undefined;

		// Casts for non-text columns used in ILIKE
		const userPublicIdText = sql<string>`${schema.users.publicId}::text`;
		const txPublicIdText = sql<string>`${schema.transactions.publicId}::text`;
		const amountText = sql<string>`${schema.transactions.amount}::text`;
		const amountPaidText = sql<string>`${schema.transactions.amountPaid}::text`;

		/**
		 * Extended search:
		 * - Match "other user" in the transaction (borrower OR lender), excluding myself
		 * - Match transaction fields (description/publicId/amount/amountPaid)
		 *
		 * NOTE: We use casts for UUID/decimal fields so Postgres can ILIKE them.
		 */
		const searchExists =
			filter.search && q
				? or(
						// Search borrower (when current user is lender)
						exists(
							this.getDb()
								.select({ id: schema.users.id })
								.from(schema.users)
								.where(
									and(
										eq(schema.users.id, schema.transactions.borrowerId),
										ne(schema.users.id, currentUserId),
										or(
											ilike(schema.users.name, q),
											ilike(schema.users.email, q),
											ilike(userPublicIdText, q),
										),
									),
								),
						),
						// Search lender (when current user is borrower)
						exists(
							this.getDb()
								.select({ id: schema.users.id })
								.from(schema.users)
								.where(
									and(
										eq(schema.users.id, schema.transactions.lenderId),
										ne(schema.users.id, currentUserId),
										or(
											ilike(schema.users.name, q),
											ilike(schema.users.email, q),
											ilike(userPublicIdText, q),
										),
									),
								),
						),

						// Match transaction fields
						ilike(schema.transactions.description, q),
						ilike(txPublicIdText, q), // ✅ uuid -> text
						ilike(amountText, q), // ✅ decimal -> text
						ilike(amountPaidText, q), // ✅ decimal -> text
					)
				: undefined;

		const conditions = [
			searchExists,
			filter.type === 'lend'
				? eq(schema.transactions.lenderId, currentUserId)
				: filter.type === 'borrow'
					? eq(schema.transactions.borrowerId, currentUserId)
					: undefined,
			filter.status ? inArray(schema.transactions.status, filter.status) : undefined,
			fromDate ? gte(schema.transactions.createdAt, fromDate) : undefined,
			toDate ? lte(schema.transactions.createdAt, toDate) : undefined,
		].filter(Boolean);

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Determine pagination parameters
		let pagination;
		let offset = 0;

		if (filter.page && filter.limit) {
			// Get total count for pagination
			const totalItems = await this.getDb()
				.select({
					count: count(),
				})
				.from(schema.transactions)
				.where(whereClause)
				.then(result => result[0].count);

			const paginationManager = new PaginationManager(filter.page, filter.limit, totalItems);
			const paginationResult = paginationManager.createPagination();
			pagination = paginationResult.pagination;
			offset = paginationResult.offset;
		}

		const transactionOrderBy = orderByColumn(schema.transactions, filter.sortBy, filter.sortOrder);

		// Determine which orderBy to use based on which table contains the field
		const orderBy = transactionOrderBy;

		// Create aliases for joining users table twice
		const borrowerUser = aliasedTable(schema.users, 'borrower');
		const lenderUser = aliasedTable(schema.users, 'lender');
		const creatorUser = aliasedTable(schema.users, 'creator');

		// Build query with all possible combinations
		const baseSelect = this.getDb()
			.select({
				id: schema.transactions.publicId,
				publicId: schema.transactions.publicId,
				borrowerId: schema.transactions.borrowerId,
				lenderId: schema.transactions.lenderId,
				borrower: {
					id: borrowerUser.publicId,
					name: borrowerUser.name,
					email: borrowerUser.email,
					image: borrowerUser.image,
				},
				lender: {
					id: lenderUser.publicId,
					name: lenderUser.name,
					email: lenderUser.email,
					image: lenderUser.image,
				},
				currency: schema.transactions.currency,
				amount: schema.transactions.amount,
				amountPaid: schema.transactions.amountPaid,
				remainingAmount: schema.transactions.remainingAmount,
				reviewAmount: schema.transactions.reviewAmount,
				status: schema.transactions.status,
				description: schema.transactions.description,
				rejectionReason: schema.transactions.rejectionReason,
				dueDate: schema.transactions.dueDate,
				requestDate: schema.transactions.requestDate,
				acceptedAt: schema.transactions.acceptedAt,
				completedAt: schema.transactions.completedAt,
				rejectedAt: schema.transactions.rejectedAt,
				createdBy: creatorUser.publicId,
				createdAt: schema.transactions.createdAt,
				updatedAt: schema.transactions.updatedAt,
			})
			.from(schema.transactions)
			.innerJoin(borrowerUser, eq(schema.transactions.borrowerId, borrowerUser.id))
			.innerJoin(lenderUser, eq(schema.transactions.lenderId, lenderUser.id))
			.innerJoin(creatorUser, eq(schema.transactions.createdBy, creatorUser.id))
			.where(whereClause);

		let rawData;
		// Handle pagination and ordering
		if (filter.page && filter.limit) {
			// Paginated query
			if (offset && orderBy) {
				rawData = await baseSelect.limit(filter.limit).offset(offset).orderBy(orderBy);
			} else if (offset) {
				rawData = await baseSelect.limit(filter.limit).offset(offset);
			} else if (orderBy) {
				rawData = await baseSelect.limit(filter.limit).orderBy(orderBy);
			} else {
				rawData = await baseSelect.limit(filter.limit);
			}
		} else {
			// Non-paginated query
			if (orderBy) {
				rawData = await baseSelect.orderBy(orderBy);
			} else {
				rawData = await baseSelect;
			}
		}

		const convertedData: TransactionListReturnType[] = rawData.map(tx => {
			// Determine type based on currentUserId
			let type: 'lend' | 'borrow' = 'borrow';

			if (tx.lenderId === currentUserId) {
				type = 'lend';
			}

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { borrowerId, lenderId, ...rest } = tx;

			return {
				...rest,
				type,
			};
		});

		return {
			data: convertedData,
			pagination,
		};
	}

	async getRequestedTransactionList(
		filter: RequestTransactionQuerySchemaType,
		currentUserId: number,
	): Promise<PaginatedResponse<TransactionListReturnType>> {
		// Create date objects from string inputs if they exist
		const fromDate = filter.from ? new Date(filter.from) : undefined;
		const toDate = filter.to ? new Date(filter.to) : undefined;

		// If toDate exists, set it to the end of the day
		if (toDate) {
			toDate.setHours(23, 59, 59, 999);
		}

		const q = filter.search ? `%${filter.search}%` : undefined;

		// Casts for non-text columns used in ILIKE
		const userPublicIdText = sql<string>`${schema.users.publicId}::text`;
		const txPublicIdText = sql<string>`${schema.transactions.publicId}::text`;
		const amountText = sql<string>`${schema.transactions.amount}::text`;
		const amountPaidText = sql<string>`${schema.transactions.amountPaid}::text`;

		/**
		 * Extended search:
		 * - Match "other user" in the transaction (borrower OR lender), excluding myself
		 * - Match transaction fields (description/publicId/amount/amountPaid)
		 *
		 * NOTE: We use casts for UUID/decimal fields so Postgres can ILIKE them.
		 */
		const searchExists =
			filter.search && q
				? or(
						// Search borrower (when current user is lender)
						exists(
							this.getDb()
								.select({ id: schema.users.id })
								.from(schema.users)
								.where(
									and(
										eq(schema.users.id, schema.transactions.borrowerId),
										ne(schema.users.id, currentUserId),
										or(
											ilike(schema.users.name, q),
											ilike(schema.users.email, q),
											ilike(userPublicIdText, q),
										),
									),
								),
						),
						// Search lender (when current user is borrower)
						exists(
							this.getDb()
								.select({ id: schema.users.id })
								.from(schema.users)
								.where(
									and(
										eq(schema.users.id, schema.transactions.lenderId),
										ne(schema.users.id, currentUserId),
										or(
											ilike(schema.users.name, q),
											ilike(schema.users.email, q),
											ilike(userPublicIdText, q),
										),
									),
								),
						),

						// Match transaction fields
						ilike(schema.transactions.description, q),
						ilike(txPublicIdText, q), // ✅ uuid -> text
						ilike(amountText, q), // ✅ decimal -> text
						ilike(amountPaidText, q), // ✅ decimal -> text
					)
				: undefined;

		function filterTypeCondition(input: TransactionTypeEnum[]): SQL<unknown> | undefined {
			if (input.includes('lend') && input.includes('borrow')) {
				return or(
					eq(schema.transactions.borrowerId, currentUserId),
					eq(schema.transactions.lenderId, currentUserId),
				);
			}
			if (input.includes('lend')) {
				return eq(schema.transactions.lenderId, currentUserId);
			}
			if (input.includes('borrow')) {
				return eq(schema.transactions.borrowerId, currentUserId);
			}
			return or(
				eq(schema.transactions.borrowerId, currentUserId),
				eq(schema.transactions.lenderId, currentUserId),
			);
		}

		const conditions = [
			filter.type
				? filterTypeCondition(filter.type)
				: or(
						eq(schema.transactions.borrowerId, currentUserId),
						eq(schema.transactions.lenderId, currentUserId),
					),
			searchExists,
			eq(schema.transactions.status, 'pending'),
			fromDate ? gte(schema.transactions.createdAt, fromDate) : undefined,
			toDate ? lte(schema.transactions.createdAt, toDate) : undefined,
		].filter(Boolean);

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Determine pagination parameters
		let pagination;
		let offset = 0;

		if (filter.page && filter.limit) {
			// Get total count for pagination
			const totalItems = await this.getDb()
				.select({
					count: count(),
				})
				.from(schema.transactions)
				.where(whereClause)
				.then(result => result[0].count);

			const paginationManager = new PaginationManager(filter.page, filter.limit, totalItems);
			const paginationResult = paginationManager.createPagination();
			pagination = paginationResult.pagination;
			offset = paginationResult.offset;
		}

		const transactionOrderBy = orderByColumn(schema.transactions, filter.sortBy, filter.sortOrder);

		// Determine which orderBy to use based on which table contains the field
		const orderBy = transactionOrderBy;

		// Create aliases for joining users table three times
		const borrowerUser = aliasedTable(schema.users, 'borrower');
		const lenderUser = aliasedTable(schema.users, 'lender');
		const creatorUser = aliasedTable(schema.users, 'creator');

		// Build query with all possible combinations
		const baseSelect = this.getDb()
			.select({
				id: schema.transactions.publicId,
				publicId: schema.transactions.publicId,
				borrowerId: schema.transactions.borrowerId,
				lenderId: schema.transactions.lenderId,
				borrower: {
					id: borrowerUser.publicId,
					name: borrowerUser.name,
					email: borrowerUser.email,
					image: borrowerUser.image,
				},
				lender: {
					id: lenderUser.publicId,
					name: lenderUser.name,
					email: lenderUser.email,
					image: lenderUser.image,
				},
				currency: schema.transactions.currency,
				amount: schema.transactions.amount,
				amountPaid: schema.transactions.amountPaid,
				remainingAmount: schema.transactions.remainingAmount,
				reviewAmount: schema.transactions.reviewAmount,
				status: schema.transactions.status,
				description: schema.transactions.description,
				rejectionReason: schema.transactions.rejectionReason,
				dueDate: schema.transactions.dueDate,
				requestDate: schema.transactions.requestDate,
				acceptedAt: schema.transactions.acceptedAt,
				completedAt: schema.transactions.completedAt,
				rejectedAt: schema.transactions.rejectedAt,
				createdBy: creatorUser.publicId,
				createdAt: schema.transactions.createdAt,
				updatedAt: schema.transactions.updatedAt,
			})
			.from(schema.transactions)
			.innerJoin(borrowerUser, eq(schema.transactions.borrowerId, borrowerUser.id))
			.innerJoin(lenderUser, eq(schema.transactions.lenderId, lenderUser.id))
			.innerJoin(creatorUser, eq(schema.transactions.createdBy, creatorUser.id))
			.where(whereClause);

		let rawData;
		// Handle pagination and ordering
		if (filter.page && filter.limit) {
			// Paginated query
			if (offset && orderBy) {
				rawData = await baseSelect.limit(filter.limit).offset(offset).orderBy(orderBy);
			} else if (offset) {
				rawData = await baseSelect.limit(filter.limit).offset(offset);
			} else if (orderBy) {
				rawData = await baseSelect.limit(filter.limit).orderBy(orderBy);
			} else {
				rawData = await baseSelect.limit(filter.limit);
			}
		} else {
			// Non-paginated query
			if (orderBy) {
				rawData = await baseSelect.orderBy(orderBy);
			} else {
				rawData = await baseSelect;
			}
		}

		const convertedData: TransactionListReturnType[] = rawData.map(tx => {
			// Determine type based on currentUserId
			let type: 'lend' | 'borrow' = 'borrow';

			if (tx.lenderId === currentUserId) {
				type = 'lend';
			}

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { borrowerId, lenderId, ...rest } = tx;

			return {
				...rest,
				type,
			};
		});

		return {
			data: convertedData,
			pagination,
		};
	}

	async getTransactionById(id: number): Promise<TransactionSchemaType> {
		const transaction = await this.getDb().query.transactions.findFirst({
			where: eq(schema.transactions.id, id),
		});

		if (!transaction) throw new NotFoundException('Transaction not found');

		return transaction;
	}

	async getTransactionByPublicId(publicId: string): Promise<TransactionSchemaType> {
		const transaction = await this.getDb().query.transactions.findFirst({
			where: eq(schema.transactions.publicId, publicId),
		});

		if (!transaction) throw new NotFoundException('Transaction not found');

		return transaction;
	}

	async getTransactionsByPublicIds(
		publicIds: string[],
		currentUserId: number,
	): Promise<TransactionSchemaType[]> {
		const transactions = await this.getDb().query.transactions.findMany({
			where: and(
				inArray(schema.transactions.publicId, publicIds),
				eq(schema.transactions.createdBy, currentUserId),
			),
		});

		return transactions;
	}

	async updateTransaction(
		id: number,
		data: ValidateUpdateTransactionDtoWithCurrency,
	): Promise<TransactionSchemaType> {
		const updatedTransaction = await this.getDb()
			.update(schema.transactions)
			.set({
				...data,
				remainingAmount: data.amount,
			})
			.where(eq(schema.transactions.id, id))
			.returning()
			.then(res => res[0]);
		return updatedTransaction;
	}

	checkEligibilityForUpdatingStatus(
		data: TransactionSchemaType,
		status: TransactionStatusEnum,
	): boolean {
		const currentStatus = data.status;

		// If status is rejected, it cannot be changed
		if (currentStatus === 'rejected') {
			return false;
		}

		// If status is completed, it cannot be changed
		if (currentStatus === 'completed') {
			return false;
		}

		// If status is pending, it can be changed to anything
		if (currentStatus === 'pending') {
			return true;
		}

		// If status is accepted, it can be changed to anything except pending and rejected
		if (currentStatus === 'accepted') {
			return status !== 'pending' && status !== 'rejected';
		}

		// If status is partially_paid, it can only be changed to completed
		if (currentStatus === 'partially_paid') {
			return status === 'completed' || status === 'requested_repay';
		}

		// If status is requested_repay, it can be changed to completed or partially_paid
		if (currentStatus === 'requested_repay') {
			return status === 'completed' || status === 'partially_paid';
		}

		return false;
	}

	checkEligibilityForReviewAmount(
		data: TransactionSchemaType,
		reviewAmount: number,
	): { eligible: boolean; reason?: string } {
		if (reviewAmount <= 0) {
			return { eligible: false, reason: 'Review amount must be greater than zero' };
		} else if (reviewAmount > data.remainingAmount) {
			return { eligible: false, reason: 'Review amount exceeds remaining amount' };
		}

		return { eligible: true };
	}

	checkEligibilityForDeleting(data: TransactionSchemaType[]): TransactionEligibilityForDeletion {
		const ineligibleTransactions: number[] = [];
		const eligibleTransactions: number[] = [];

		data.forEach(transaction => {
			const currentStatus = transaction.status;
			// Only pending transactions can be deleted
			if (currentStatus !== 'pending') {
				ineligibleTransactions.push(transaction.id);
			} else {
				eligibleTransactions.push(transaction.id);
			}
		});

		return { ineligibleTransactions, eligibleTransactions };
	}

	calculateReviewAmount(status: TransactionStatusEnum, amount: number): number {
		if (status === 'requested_repay') {
			return amount;
		} else if (status === 'partially_paid' || status === 'completed') {
			return 0;
		}
		return 0;
	}

	calculateRemainingAmount(
		currentRemainingAmount: number,
		reviewAmount: number,
		status: TransactionStatusEnum,
	): number {
		if (status === 'requested_repay') {
			return currentRemainingAmount;
		} else if (status === 'partially_paid' || status === 'completed') {
			return currentRemainingAmount - reviewAmount;
		}
		return currentRemainingAmount;
	}

	calculateAmountPaid(
		currentAmountPaid: number,
		reviewAmount: number,
		status: TransactionStatusEnum,
	): number {
		if (status === 'requested_repay') {
			return currentAmountPaid;
		} else if (status === 'partially_paid' || status === 'completed') {
			return currentAmountPaid + reviewAmount;
		}
		return currentAmountPaid;
	}

	defineTransactionStatusAfterAccepting(
		remainingAmount: number,
		reviewAmount: number,
	): TransactionStatusEnum {
		console.log(`Remaining Amount: ${remainingAmount}, Review Amount: ${reviewAmount}`);
		// If reviewAmount equals remainingAmount, status is completed
		if (reviewAmount === remainingAmount) {
			return 'completed';
		}
		// If reviewAmount is less than remainingAmount, status is partially_paid
		else if (reviewAmount !== remainingAmount) {
			return 'partially_paid';
		}
		// Default to accepted
		return 'accepted';
	}

	async updateTransactionStatus(
		id: number,
		status: TransactionStatusEnum,
		objects: {
			remainingAmount?: number;
			amountPaid?: number;
			rejectionReason?: string;
			reviewAmount?: number;
		},
	): Promise<TransactionSchemaType> {
		const updatedTransaction = await this.getDb()
			.update(schema.transactions)
			.set({
				status,
				rejectionReason: objects.rejectionReason,
				acceptedAt: status === 'accepted' ? new Date() : null,
				completedAt: status === 'completed' ? new Date() : null,
				rejectedAt: status === 'rejected' ? new Date() : null,
				reviewAmount: objects.reviewAmount,
				remainingAmount: objects.remainingAmount,
				amountPaid: objects.amountPaid,
			})
			.where(eq(schema.transactions.id, id))
			.returning()
			.then(res => res[0]);
		return updatedTransaction;
	}

	async deleteTransaction(ids: number[]): Promise<string> {
		await this.getDb().delete(schema.transactions).where(inArray(schema.transactions.id, ids));
		return 'Transaction deleted successfully';
	}
}
