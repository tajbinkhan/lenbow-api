import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, exists, gte, ilike, lte, ne, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PaginatedResponse } from '../../core/api-response.interceptor';
import PaginationManager from '../../core/pagination';
import { DATABASE_CONNECTION } from '../../database/connection';
import { orderByColumn } from '../../database/helpers';
import schema from '../../database/schema';
import DrizzleService from '../../database/service';
import { type ContactSchemaType } from '../../database/types';
import { AuthService } from '../auth/auth.service';
import type { ContactListReturnType } from '../contacts/@types/contacts.types';
import type { ConnectedContactList } from './@types/contacts.types';
import { ContactQuerySchemaType } from './contacts.schema';

@Injectable()
export class ContactsService extends DrizzleService {
	constructor(
		@Inject(DATABASE_CONNECTION)
		db: NodePgDatabase<typeof schema>,
		private readonly authService: AuthService,
	) {
		super(db);
	}

	async getOrCreateContactByPublicId(
		lenderId: string,
		borrowerId: number,
	): Promise<ContactSchemaType> {
		// Find user by public ID
		const lender = await this.authService.findUserByPublicId(lenderId);

		if (lender.id === borrowerId) {
			throw new BadRequestException('You cannot request a loan or borrow from yourself');
		}

		// Check if contact exists in either direction
		const existingContact = await this.getDb()
			.select()
			.from(schema.contacts)
			.where(
				or(
					and(
						eq(schema.contacts.connectedUserId, lender.id),
						eq(schema.contacts.requestedUserId, borrowerId),
					),
					and(
						eq(schema.contacts.connectedUserId, borrowerId),
						eq(schema.contacts.requestedUserId, lender.id),
					),
				),
			)
			.limit(1)
			.then(res => res[0]);

		// If contact exists in either direction, return it
		if (existingContact) {
			return existingContact;
		}

		// Otherwise, create new contact
		const newContact = await this.getDb()
			.insert(schema.contacts)
			.values({
				connectedUserId: lender.id,
				requestedUserId: borrowerId,
			})
			.returning()
			.then(res => res[0]);

		if (!newContact) throw new NotFoundException('Contact not found');

		return newContact;
	}

	async getConnectedContacts(currentUserId: number): Promise<ConnectedContactList[]> {
		const results = await this.getDb()
			.select({
				userId: schema.users.publicId,
				name: schema.users.name,
				email: schema.users.email,
				image: schema.users.image,
				phone: schema.users.phone,
				connectedAt: schema.contacts.createdAt,
			})
			.from(schema.contacts)
			.innerJoin(
				schema.users,
				sql`${schema.users.id} = CASE
        WHEN ${schema.contacts.requestedUserId} = ${currentUserId}
        THEN ${schema.contacts.connectedUserId}
        ELSE ${schema.contacts.requestedUserId}
      END`,
			)
			.where(
				and(
					or(
						eq(schema.contacts.requestedUserId, currentUserId),
						eq(schema.contacts.connectedUserId, currentUserId),
					),
				),
			)
			.orderBy(desc(schema.contacts.createdAt));

		// Remove duplicates by userId (keep first occurrence = most recent)
		const seen = new Set<string>();
		return results.filter(contact => {
			if (seen.has(contact.userId)) {
				return false;
			}
			seen.add(contact.userId);
			return true;
		});
	}

	async getConnectedContactList(
		filter: ContactQuerySchemaType,
		currentUserId: number,
	): Promise<PaginatedResponse<ContactListReturnType>> {
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
		const txPublicIdText = sql<string>`${schema.contacts.publicId}::text`;

		/**
		 * Extended search:
		 * - Match "other user" in the contact (borrower OR lender), excluding myself
		 * - Match contact fields (description/publicId/amount/amountPaid)
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
										eq(schema.users.id, schema.contacts.requestedUserId),
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
										eq(schema.users.id, schema.contacts.connectedUserId),
										ne(schema.users.id, currentUserId),
										or(
											ilike(schema.users.name, q),
											ilike(schema.users.email, q),
											ilike(userPublicIdText, q),
										),
									),
								),
						),

						// Match contact fields
						ilike(txPublicIdText, q), // ✅ uuid -> text
					)
				: undefined;

		const conditions = [
			searchExists,
			or(
				eq(schema.contacts.requestedUserId, currentUserId),
				eq(schema.contacts.connectedUserId, currentUserId),
			),
			fromDate ? gte(schema.contacts.createdAt, fromDate) : undefined,
			toDate ? lte(schema.contacts.createdAt, toDate) : undefined,
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
				.from(schema.contacts)
				.where(whereClause)
				.then(result => result[0].count);

			const paginationManager = new PaginationManager(filter.page, filter.limit, totalItems);
			const paginationResult = paginationManager.createPagination();
			pagination = paginationResult.pagination;
			offset = paginationResult.offset;
		}

		const contactOrderBy = orderByColumn(schema.contacts, filter.sortBy, filter.sortOrder);

		// Determine which orderBy to use based on which table contains the field
		const orderBy = contactOrderBy;

		// Build query with all possible combinations
		const baseSelect = this.getDb()
			.select({
				id: schema.contacts.publicId,
				userId: schema.users.publicId,
				name: schema.users.name,
				email: schema.users.email,
				image: schema.users.image,
				phone: schema.users.phone,
				connectedAt: schema.contacts.createdAt,
				createdAt: schema.contacts.createdAt,
				updatedAt: schema.contacts.updatedAt,
			})
			.from(schema.contacts)
			.innerJoin(
				schema.users,
				sql`${schema.users.id} = CASE
        WHEN ${schema.contacts.requestedUserId} = ${currentUserId}
        THEN ${schema.contacts.connectedUserId}
        ELSE ${schema.contacts.requestedUserId}
      END`,
			)
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
}
