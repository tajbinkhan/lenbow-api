import { Inject, Injectable } from '@nestjs/common';
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
	SQL,
	sql,
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PaginatedResponse } from '../../core/api-response.interceptor';
import PaginationManager from '../../core/pagination';
import { DATABASE_CONNECTION } from '../../database/connection';
import { orderByColumn } from '../../database/helpers';
import schema from '../../database/schema';
import DrizzleService from '../../database/service';
import { TransactionHistoriesSchemaType, TransactionTypeEnum } from '../../database/types';
import {
	TransactionHistoriesDataType,
	TransactionHistoriesReturnType,
	TransactionHistoryDataEntryType,
} from './@types/history.types';
import { TransactionHistoryQuerySchemaType } from './history.schema';

@Injectable()
export class HistoryService extends DrizzleService {
	constructor(
		@Inject(DATABASE_CONNECTION)
		db: NodePgDatabase<typeof schema>,
	) {
		super(db);
	}

	async createTransactionHistoryRecord(
		data: TransactionHistoriesDataType,
	): Promise<TransactionHistoriesSchemaType> {
		const { details, ...rest } = data;

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { id, publicId, ...detailsWithoutId } = details;

		const entryDetails: TransactionHistoryDataEntryType = {
			transactionPublicId: details.id,
			...detailsWithoutId,
			...rest,
		};

		const result = await this.getDb()
			.insert(schema.transactionHistories)
			.values(entryDetails)
			.returning()
			.then(res => res[0]);
		return result;
	}

	async getTransactionHistory(
		filter: TransactionHistoryQuerySchemaType,
		currentUserId: number,
	): Promise<PaginatedResponse<TransactionHistoriesReturnType>> {
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
		const txPublicIdText = sql<string>`${schema.transactionHistories.transactionPublicId}::text`;
		const amountText = sql<string>`${schema.transactionHistories.amount}::text`;
		const amountPaidText = sql<string>`${schema.transactionHistories.amountPaid}::text`;

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
										eq(schema.users.id, schema.transactionHistories.borrowerId),
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
										eq(schema.users.id, schema.transactionHistories.lenderId),
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
						ilike(schema.transactionHistories.description, q),
						ilike(txPublicIdText, q), // ✅ uuid -> text
						ilike(amountText, q), // ✅ decimal -> text
						ilike(amountPaidText, q), // ✅ decimal -> text
					)
				: undefined;

		function filterTypeCondition(input: TransactionTypeEnum[]): SQL<unknown> | undefined {
			if (input.includes('lend') && input.includes('borrow')) {
				return or(
					eq(schema.transactionHistories.borrowerId, currentUserId),
					eq(schema.transactionHistories.lenderId, currentUserId),
				);
			}
			if (input.includes('lend')) {
				return eq(schema.transactionHistories.lenderId, currentUserId);
			}
			if (input.includes('borrow')) {
				return eq(schema.transactionHistories.borrowerId, currentUserId);
			}
			return or(
				eq(schema.transactionHistories.borrowerId, currentUserId),
				eq(schema.transactionHistories.lenderId, currentUserId),
			);
		}

		const conditions = [
			filter.type
				? filterTypeCondition(filter.type)
				: or(
						eq(schema.transactionHistories.borrowerId, currentUserId),
						eq(schema.transactionHistories.lenderId, currentUserId),
					),
			searchExists,
			filter.status ? inArray(schema.transactionHistories.status, filter.status) : undefined,
			fromDate ? gte(schema.transactionHistories.createdAt, fromDate) : undefined,
			toDate ? lte(schema.transactionHistories.createdAt, toDate) : undefined,
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
				.from(schema.transactionHistories)
				.where(whereClause)
				.then(result => result[0].count);

			const paginationManager = new PaginationManager(filter.page, filter.limit, totalItems);
			const paginationResult = paginationManager.createPagination();
			pagination = paginationResult.pagination;
			offset = paginationResult.offset;
		}

		const transactionOrderBy = orderByColumn(
			schema.transactionHistories,
			filter.sortBy,
			filter.sortOrder,
		);

		// Determine which orderBy to use based on which table contains the field
		const orderBy = transactionOrderBy;

		// Create aliases for joining users table twice
		const borrowerUser = aliasedTable(schema.users, 'borrower');
		const lenderUser = aliasedTable(schema.users, 'lender');

		// Build query with all possible combinations
		const baseSelect = this.getDb()
			.select({
				id: schema.transactionHistories.publicId,
				publicId: schema.transactionHistories.publicId,
				transactionId: schema.transactionHistories.transactionId,
				transactionPublicId: schema.transactionHistories.transactionPublicId,
				borrowerId: schema.transactionHistories.borrowerId,
				lenderId: schema.transactionHistories.lenderId,
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
				currency: schema.transactionHistories.currency,
				amount: schema.transactionHistories.amount,
				amountPaid: schema.transactionHistories.amountPaid,
				remainingAmount: schema.transactionHistories.remainingAmount,
				reviewAmount: schema.transactionHistories.reviewAmount,
				status: schema.transactionHistories.status,
				description: schema.transactionHistories.description,
				rejectionReason: schema.transactionHistories.rejectionReason,
				dueDate: schema.transactionHistories.dueDate,
				requestDate: schema.transactionHistories.requestDate,
				acceptedAt: schema.transactionHistories.acceptedAt,
				completedAt: schema.transactionHistories.completedAt,
				rejectedAt: schema.transactionHistories.rejectedAt,
				createdAt: schema.transactionHistories.createdAt,
				updatedAt: schema.transactionHistories.updatedAt,
				action: schema.transactionHistories.action,
				occurredAt: schema.transactionHistories.occurredAt,
			})
			.from(schema.transactionHistories)
			.innerJoin(borrowerUser, eq(schema.transactionHistories.borrowerId, borrowerUser.id))
			.innerJoin(lenderUser, eq(schema.transactionHistories.lenderId, lenderUser.id))
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

		const convertedData: TransactionHistoriesReturnType[] = rawData.map(tx => {
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
}
