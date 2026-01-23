import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, lt, lte, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../../database/connection';
import schema from '../../database/schema';
import DrizzleService from '../../database/service';
import type {
	ActionRequiredItem,
	ChartData,
	MetricsData,
	MonthlyActivityData,
	OverviewResponse,
	RecentTransaction,
	StatusDistribution,
	UpcomingDueDate,
} from './@types/overview.types';
import type { OverviewQuerySchemaType } from './overview.schema';

@Injectable()
export class OverviewService extends DrizzleService {
	constructor(
		@Inject(DATABASE_CONNECTION)
		db: NodePgDatabase<typeof schema>,
	) {
		super(db);
	}

	async getOverview(userId: number, options: OverviewQuerySchemaType): Promise<OverviewResponse> {
		const [metrics, actionRequired, chartData, recentTransactions, upcomingDueDates] =
			await Promise.all([
				this.getMetrics(userId),
				this.getActionRequired(userId, options.actionRequiredLimit || 10),
				this.getChartData(userId, options.monthsBack || 6),
				this.getRecentTransactions(userId, options.recentLimit || 10),
				this.getUpcomingDueDates(userId, options.upcomingLimit || 5),
			]);

		return {
			metrics,
			actionRequired,
			chartData,
			recentTransactions,
			upcomingDueDates,
		};
	}

	private async getMetrics(userId: number): Promise<MetricsData> {
		const now = new Date();

		// Get total borrowed (user is borrower)
		const totalBorrowedResult = await this.getDb()
			.select({
				total: sql<number>`COALESCE(SUM(${schema.transactions.remainingAmount}), 0)`,
			})
			.from(schema.transactions)
			.where(
				and(
					eq(schema.transactions.borrowerId, userId),
					inArray(schema.transactions.status, ['accepted', 'partially_paid', 'requested_repay']),
				),
			)
			.then(res => res[0]);

		// Get total lent (user is lender)
		const totalLentResult = await this.getDb()
			.select({
				total: sql<number>`COALESCE(SUM(${schema.transactions.remainingAmount}), 0)`,
			})
			.from(schema.transactions)
			.where(
				and(
					eq(schema.transactions.lenderId, userId),
					inArray(schema.transactions.status, ['accepted', 'partially_paid', 'requested_repay']),
				),
			)
			.then(res => res[0]);

		// Get pending requests (user is lender)
		const pendingRequestsResult = await this.getDb()
			.select({
				count: count(),
			})
			.from(schema.transactions)
			.where(
				and(eq(schema.transactions.lenderId, userId), eq(schema.transactions.status, 'pending')),
			)
			.then(res => res[0]);

		// Get overdue loans count (past due date)
		const overdueResult = await this.getDb()
			.select({
				countBorrowed: sql<number>`COUNT(CASE WHEN ${schema.transactions.borrowerId} = ${userId} THEN 1 END)`,
				countLent: sql<number>`COUNT(CASE WHEN ${schema.transactions.lenderId} = ${userId} THEN 1 END)`,
			})
			.from(schema.transactions)
			.where(
				and(
					or(eq(schema.transactions.borrowerId, userId), eq(schema.transactions.lenderId, userId)),
					lt(schema.transactions.dueDate, now),
					inArray(schema.transactions.status, ['accepted', 'partially_paid', 'requested_repay']),
				),
			)
			.then(res => res[0]);

		// Get total contacts
		const totalContactsResult = await this.getDb()
			.select({
				count: count(),
			})
			.from(schema.contacts)
			.where(
				or(
					eq(schema.contacts.requestedUserId, userId),
					eq(schema.contacts.connectedUserId, userId),
				),
			)
			.then(res => res[0]);

		// Get repayment requests (user is lender, status is requested_repay)
		const repaymentRequestsResult = await this.getDb()
			.select({
				count: count(),
			})
			.from(schema.transactions)
			.where(
				and(
					eq(schema.transactions.lenderId, userId),
					eq(schema.transactions.status, 'requested_repay'),
				),
			)
			.then(res => res[0]);

		return {
			totalBorrowed: Number(totalBorrowedResult.total || 0),
			totalLent: Number(totalLentResult.total || 0),
			pendingRequests: pendingRequestsResult.count,
			overdueCount: Number(overdueResult.countBorrowed || 0) + Number(overdueResult.countLent || 0),
			overdueBorrowed: Number(overdueResult.countBorrowed || 0),
			overdueLent: Number(overdueResult.countLent || 0),
			totalContacts: totalContactsResult.count,
			repaymentRequests: repaymentRequestsResult.count,
		};
	}

	private async getActionRequired(userId: number, limit: number): Promise<ActionRequiredItem[]> {
		const now = new Date();

		// Create aliases for borrower and lender
		const borrower = schema.users;
		const lender = sql`lender_user`;

		const results = await this.getDb()
			.select({
				publicId: schema.transactions.publicId,
				amount: schema.transactions.amount,
				currency: schema.transactions.currency,
				status: schema.transactions.status,
				dueDate: schema.transactions.dueDate,
				requestDate: schema.transactions.requestDate,
				borrowerId: schema.transactions.borrowerId,
				lenderId: schema.transactions.lenderId,
				borrowerName: borrower.name,
				borrowerEmail: borrower.email,
				borrowerImage: borrower.image,
				lenderName: sql<string | null>`lender_user.name`,
				lenderEmail: sql<string>`lender_user.email`,
				lenderImage: sql<string | null>`lender_user.image`,
			})
			.from(schema.transactions)
			.innerJoin(borrower, eq(schema.transactions.borrowerId, borrower.id))
			.innerJoin(
				sql`${schema.users} AS lender_user`,
				sql`${schema.transactions.lenderId} = lender_user.id`,
			)
			.where(
				or(
					// Pending requests for lender
					and(eq(schema.transactions.lenderId, userId), eq(schema.transactions.status, 'pending')),
					// Repayment requests for lender
					and(
						eq(schema.transactions.lenderId, userId),
						eq(schema.transactions.status, 'requested_repay'),
					),
					// Overdue loans
					and(
						or(
							eq(schema.transactions.borrowerId, userId),
							eq(schema.transactions.lenderId, userId),
						),
						lt(schema.transactions.dueDate, now),
						inArray(schema.transactions.status, ['accepted', 'partially_paid', 'requested_repay']),
					),
				),
			)
			.orderBy(desc(schema.transactions.requestDate))
			.limit(limit);

		return results.map(row => {
			const isUserBorrower = row.borrowerId === userId;
			const otherParty = isUserBorrower
				? {
						name: row.lenderName,
						email: row.lenderEmail,
						image: row.lenderImage,
					}
				: {
						name: row.borrowerName,
						email: row.borrowerEmail,
						image: row.borrowerImage,
					};

			let type: ActionRequiredItem['type'] = 'pending_request';
			if (row.status === 'requested_repay') {
				type = 'repayment_request';
			} else if (
				row.dueDate &&
				row.dueDate < now &&
				['accepted', 'partially_paid', 'requested_repay'].includes(row.status)
			) {
				type = 'overdue_loan';
			}

			const daysOverdue = row.dueDate
				? Math.floor((now.getTime() - row.dueDate.getTime()) / (1000 * 60 * 60 * 24))
				: undefined;

			return {
				type,
				transactionId: row.publicId,
				amount: Number(row.amount),
				currency: row.currency,
				otherParty,
				daysOverdue: daysOverdue && daysOverdue > 0 ? daysOverdue : undefined,
				dueDate: row.dueDate,
				status: row.status,
				userRole: isUserBorrower ? 'borrower' : 'lender',
				requestDate: row.requestDate,
			};
		});
	}

	private async getChartData(userId: number, monthsBack: number): Promise<ChartData> {
		// Get status distribution as borrower
		const statusDistributionAsBorrowerResults = await this.getDb()
			.select({
				status: schema.transactions.status,
				count: count(),
			})
			.from(schema.transactions)
			.where(eq(schema.transactions.borrowerId, userId))
			.groupBy(schema.transactions.status);

		const statusDistributionAsBorrower: StatusDistribution = {
			pending: 0,
			accepted: 0,
			partially_paid: 0,
			completed: 0,
			rejected: 0,
			requested_repay: 0,
		};

		statusDistributionAsBorrowerResults.forEach(row => {
			statusDistributionAsBorrower[row.status] = row.count;
		});

		// Get status distribution as lender
		const statusDistributionAsLenderResults = await this.getDb()
			.select({
				status: schema.transactions.status,
				count: count(),
			})
			.from(schema.transactions)
			.where(eq(schema.transactions.lenderId, userId))
			.groupBy(schema.transactions.status);

		const statusDistributionAsLender: StatusDistribution = {
			pending: 0,
			accepted: 0,
			partially_paid: 0,
			completed: 0,
			rejected: 0,
			requested_repay: 0,
		};

		statusDistributionAsLenderResults.forEach(row => {
			statusDistributionAsLender[row.status] = row.count;
		});

		// Get monthly activity for the last N months
		const startDate = new Date();
		startDate.setMonth(startDate.getMonth() - monthsBack);
		startDate.setDate(1);
		startDate.setHours(0, 0, 0, 0);

		const monthlyActivityResults = await this.getDb()
			.select({
				month: sql<string>`TO_CHAR(${schema.transactions.requestDate}, 'YYYY-MM')`,
				borrowed: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.borrowerId} = ${userId} THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
				lent: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.lenderId} = ${userId} THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
			})
			.from(schema.transactions)
			.where(
				and(
					gte(schema.transactions.requestDate, startDate),
					or(eq(schema.transactions.borrowerId, userId), eq(schema.transactions.lenderId, userId)),
				),
			)
			.groupBy(sql`TO_CHAR(${schema.transactions.requestDate}, 'YYYY-MM')`)
			.orderBy(sql`TO_CHAR(${schema.transactions.requestDate}, 'YYYY-MM')`);

		const monthlyActivity: MonthlyActivityData[] = monthlyActivityResults.map(row => ({
			month: row.month,
			borrowed: Number(row.borrowed || 0),
			lent: Number(row.lent || 0),
		}));

		return {
			statusDistributionAsBorrower,
			statusDistributionAsLender,
			monthlyActivity,
		};
	}

	private async getRecentTransactions(userId: number, limit: number): Promise<RecentTransaction[]> {
		const results = await this.getDb()
			.select({
				publicId: schema.transactions.publicId,
				amount: schema.transactions.amount,
				currency: schema.transactions.currency,
				status: schema.transactions.status,
				dueDate: schema.transactions.dueDate,
				requestDate: schema.transactions.requestDate,
				description: schema.transactions.description,
				borrowerId: schema.transactions.borrowerId,
				lenderId: schema.transactions.lenderId,
				borrowerName: schema.users.name,
				borrowerEmail: schema.users.email,
				borrowerImage: schema.users.image,
				lenderName: sql<string | null>`lender_user.name`,
				lenderEmail: sql<string>`lender_user.email`,
				lenderImage: sql<string | null>`lender_user.image`,
			})
			.from(schema.transactions)
			.innerJoin(schema.users, eq(schema.transactions.borrowerId, schema.users.id))
			.innerJoin(
				sql`${schema.users} AS lender_user`,
				sql`${schema.transactions.lenderId} = lender_user.id`,
			)
			.where(
				or(eq(schema.transactions.borrowerId, userId), eq(schema.transactions.lenderId, userId)),
			)
			.orderBy(desc(schema.transactions.requestDate))
			.limit(limit);

		return results.map(row => {
			const isUserBorrower = row.borrowerId === userId;
			const otherParty = isUserBorrower
				? {
						name: row.lenderName,
						email: row.lenderEmail,
						image: row.lenderImage,
					}
				: {
						name: row.borrowerName,
						email: row.borrowerEmail,
						image: row.borrowerImage,
					};

			return {
				id: row.publicId,
				amount: Number(row.amount),
				currency: row.currency,
				status: row.status,
				type: isUserBorrower ? 'borrow' : 'lend',
				otherParty,
				date: row.requestDate,
				dueDate: row.dueDate,
				description: row.description,
			};
		});
	}

	private async getUpcomingDueDates(userId: number, limit: number): Promise<UpcomingDueDate[]> {
		const now = new Date();
		const futureDate = new Date();
		futureDate.setDate(futureDate.getDate() + 30); // Next 30 days

		const results = await this.getDb()
			.select({
				publicId: schema.transactions.publicId,
				amount: schema.transactions.amount,
				remainingAmount: schema.transactions.remainingAmount,
				currency: schema.transactions.currency,
				dueDate: schema.transactions.dueDate,
				status: schema.transactions.status,
				borrowerId: schema.transactions.borrowerId,
				lenderId: schema.transactions.lenderId,
				borrowerName: schema.users.name,
				borrowerEmail: schema.users.email,
				borrowerImage: schema.users.image,
				lenderName: sql<string | null>`lender_user.name`,
				lenderEmail: sql<string>`lender_user.email`,
				lenderImage: sql<string | null>`lender_user.image`,
			})
			.from(schema.transactions)
			.innerJoin(schema.users, eq(schema.transactions.borrowerId, schema.users.id))
			.innerJoin(
				sql`${schema.users} AS lender_user`,
				sql`${schema.transactions.lenderId} = lender_user.id`,
			)
			.where(
				and(
					or(eq(schema.transactions.borrowerId, userId), eq(schema.transactions.lenderId, userId)),
					gte(schema.transactions.dueDate, now),
					lte(schema.transactions.dueDate, futureDate),
					inArray(schema.transactions.status, ['accepted', 'partially_paid', 'requested_repay']),
				),
			)
			.orderBy(schema.transactions.dueDate)
			.limit(limit);

		return results.map(row => {
			const isUserBorrower = row.borrowerId === userId;
			const otherParty = isUserBorrower
				? {
						name: row.lenderName,
						email: row.lenderEmail,
						image: row.lenderImage,
					}
				: {
						name: row.borrowerName,
						email: row.borrowerEmail,
						image: row.borrowerImage,
					};

			const daysUntilDue = row.dueDate
				? Math.ceil((row.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
				: 0;

			let urgency: 'high' | 'medium' | 'low' = 'low';
			if (daysUntilDue <= 3) {
				urgency = 'high';
			} else if (daysUntilDue <= 7) {
				urgency = 'medium';
			}

			return {
				id: row.publicId,
				amount: Number(row.amount),
				remainingAmount: Number(row.remainingAmount),
				currency: row.currency,
				dueDate: row.dueDate!,
				type: isUserBorrower ? 'borrow' : 'lend',
				otherParty,
				daysUntilDue,
				urgency,
				status: row.status,
			};
		});
	}
}
