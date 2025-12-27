import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, eq, exists, gte, ilike, inArray, lte, ne, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuthService } from 'src/app/auth/auth.service';
import type { TransactionListReturnType } from 'src/app/transactions/@types/transactions.types';
import {
	ValidateTransactionDto,
	ValidateUpdateTransactionDto,
	type TransactionQuerySchemaType,
} from 'src/app/transactions/transactions.schema';
import type { PaginatedResponse } from 'src/core/api-response.interceptor';
import PaginationManager from 'src/core/pagination';
import { DATABASE_CONNECTION } from 'src/database/connection';
import { orderByColumn } from 'src/database/helpers';
import schema from 'src/database/schema';
import DrizzleService from 'src/database/service';
import {
	TransactionSchemaType,
	TransactionStatusEnum,
	type ContactSchemaType,
} from 'src/database/types';

@Injectable()
export class TransactionsService extends DrizzleService {
	constructor(
		@Inject(DATABASE_CONNECTION)
		db: NodePgDatabase<typeof schema>,
		private readonly authService: AuthService,
	) {
		super(db);
	}

	async createTransaction(data: ValidateTransactionDto): Promise<TransactionSchemaType> {
		const newTransaction = await this.getDb()
			.insert(schema.transactions)
			.values(data)
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
		 * - Match "other user" in the contact relationship (name/email/publicId), excluding myself
		 * - Match transaction fields (description/publicId/amount/amountPaid)
		 *
		 * NOTE: We use casts for UUID/decimal fields so Postgres can ILIKE them.
		 */
		const searchExists =
			filter.search && q
				? or(
						// Match "other user" in the contact relationship
						exists(
							this.getDb()
								.select({ id: schema.users.id })
								.from(schema.users)
								.innerJoin(
									schema.contacts,
									or(
										eq(schema.contacts.borrowerId, schema.users.id),
										eq(schema.contacts.requesterId, schema.users.id),
									),
								)
								.where(
									and(
										// correlate subquery to outer transactions row
										eq(schema.contacts.id, schema.transactions.requesterId),
										or(
											ilike(schema.users.name, q),
											ilike(schema.users.email, q),
											ilike(userPublicIdText, q), // ✅ uuid -> text
										),
										// exclude myself
										ne(schema.users.id, currentUserId),
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
			eq(schema.transactions.borrowerId, currentUserId),
			searchExists,
			filter.type ? inArray(schema.transactions.type, filter.type) : undefined,
			filter.status ? inArray(schema.transactions.status, filter.status) : undefined,
			fromDate ? gte(schema.transactions.createdAt, fromDate) : undefined,
			toDate ? lte(schema.transactions.createdAt, toDate) : undefined,
		].filter(Boolean);

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Determine pagination parameters
		let pagination;
		let offset = 0;
		let totalItems = 0;

		if (filter.page && filter.limit) {
			// Get total count for pagination
			totalItems = await this.getDb()
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

		// Build query with all possible combinations
		const baseSelect = this.getDb()
			.select({
				id: schema.transactions.publicId,
				publicId: schema.transactions.publicId,
				contact: {
					id: schema.users.publicId,
					name: schema.users.name,
					email: schema.users.email,
					image: schema.users.image,
				},
				type: schema.transactions.type,
				amount: schema.transactions.amount,
				amountPaid: schema.transactions.amountPaid,
				status: schema.transactions.status,
				description: schema.transactions.description,
				dueDate: schema.transactions.dueDate,
				createdAt: schema.transactions.createdAt,
				updatedAt: schema.transactions.updatedAt,
			})
			.from(schema.transactions)
			.leftJoin(schema.contacts, eq(schema.transactions.requesterId, schema.contacts.id))
			.leftJoin(schema.users, eq(schema.transactions.borrowerId, schema.users.id))
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

		return {
			data: rawData,
			pagination,
		};
	}

	async getRequestedTransactionList(
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
		 * - Match "other user" in the contact relationship (name/email/publicId), excluding myself
		 * - Match transaction fields (description/publicId/amount/amountPaid)
		 *
		 * NOTE: We use casts for UUID/decimal fields so Postgres can ILIKE them.
		 */
		const searchExists =
			filter.search && q
				? or(
						// Match "other user" in the contact relationship
						exists(
							this.getDb()
								.select({ id: schema.users.id })
								.from(schema.users)
								.innerJoin(
									schema.contacts,
									or(
										eq(schema.contacts.borrowerId, schema.users.id),
										eq(schema.contacts.requesterId, schema.users.id),
									),
								)
								.where(
									and(
										// correlate subquery to outer transactions row
										eq(schema.contacts.id, schema.transactions.requesterId),
										or(
											ilike(schema.users.name, q),
											ilike(schema.users.email, q),
											ilike(userPublicIdText, q), // ✅ uuid -> text
										),
										// exclude myself
										ne(schema.users.id, currentUserId),
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
			eq(schema.transactions.borrowerId, currentUserId),
			searchExists,
			filter.type ? inArray(schema.transactions.type, filter.type) : undefined,
			filter.status ? inArray(schema.transactions.status, filter.status) : undefined,
			fromDate ? gte(schema.transactions.createdAt, fromDate) : undefined,
			toDate ? lte(schema.transactions.createdAt, toDate) : undefined,
		].filter(Boolean);

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Determine pagination parameters
		let pagination;
		let offset = 0;
		let totalItems = 0;

		if (filter.page && filter.limit) {
			// Get total count for pagination
			totalItems = await this.getDb()
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

		// Build query with all possible combinations
		const baseSelect = this.getDb()
			.select({
				id: schema.transactions.publicId,
				publicId: schema.transactions.publicId,
				contact: {
					id: schema.users.publicId,
					name: schema.users.name,
					email: schema.users.email,
					image: schema.users.image,
				},
				type: schema.transactions.type,
				amount: schema.transactions.amount,
				amountPaid: schema.transactions.amountPaid,
				status: schema.transactions.status,
				description: schema.transactions.description,
				dueDate: schema.transactions.dueDate,
				createdAt: schema.transactions.createdAt,
				updatedAt: schema.transactions.updatedAt,
			})
			.from(schema.transactions)
			.leftJoin(schema.contacts, eq(schema.transactions.requesterId, schema.contacts.id))
			.leftJoin(schema.users, eq(schema.transactions.borrowerId, schema.users.id))
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

		return {
			data: rawData,
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

	async getTransactionsByPublicIds(publicIds: string[]): Promise<TransactionSchemaType[]> {
		const transactions = await this.getDb().query.transactions.findMany({
			where: inArray(schema.transactions.publicId, publicIds),
		});

		return transactions;
	}

	async updateTransaction(
		id: number,
		data: ValidateUpdateTransactionDto,
	): Promise<TransactionSchemaType> {
		const updatedTransaction = await this.getDb()
			.update(schema.transactions)
			.set(data)
			.where(eq(schema.transactions.id, id))
			.returning()
			.then(res => res[0]);
		return updatedTransaction;
	}

	async updateTransactionPaidAmount(
		id: number,
		amountPaid: number,
	): Promise<TransactionSchemaType> {
		const updatedTransaction = await this.getDb()
			.update(schema.transactions)
			.set({ amountPaid })
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
			return status === 'completed';
		}

		return false;
	}

	checkEligibilityForDeleting(data: TransactionSchemaType[]): {
		ineligibleTransactions: number[];
		eligibleTransactions: number[];
	} {
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

	async updateTransactionStatus(
		id: number,
		status: TransactionStatusEnum,
	): Promise<TransactionSchemaType> {
		const updatedTransaction = await this.getDb()
			.update(schema.transactions)
			.set({ status })
			.where(eq(schema.transactions.id, id))
			.returning()
			.then(res => res[0]);
		return updatedTransaction;
	}

	async deleteTransaction(ids: number[]): Promise<string> {
		await this.getDb().delete(schema.transactions).where(inArray(schema.transactions.id, ids));
		return 'Transaction deleted successfully';
	}

	// Transaction contacts
	async getOrCreateContactByPublicId(
		borrowerId: string,
		requesterId: number,
	): Promise<ContactSchemaType> {
		// Find user by public ID
		const borrower = await this.authService.findUserByPublicId(borrowerId);

		if (borrower.id === requesterId) {
			throw new BadRequestException('You cannot request a loan or borrow from yourself');
		}

		const getOrCreateContact = await this.getDb()
			.insert(schema.contacts)
			.values({
				borrowerId: borrower.id,
				requesterId,
			})
			.onConflictDoUpdate({
				target: [schema.contacts.borrowerId, schema.contacts.requesterId],
				set: {
					borrowerId: schema.contacts.borrowerId, // no-op update
				},
			})
			.returning()
			.then(res => res[0]);

		if (!getOrCreateContact) throw new NotFoundException('Contact not found');

		return getOrCreateContact;
	}
}
