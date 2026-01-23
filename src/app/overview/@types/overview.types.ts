import { TransactionStatusEnum, TransactionTypeEnum } from '../../../database/types';
import { CurrencyData } from '../../currency/@types/currency.types';

export interface MetricsData {
	totalBorrowed: number;
	totalLent: number;
	pendingRequests: number;
	overdueCount: number;
	overdueBorrowed: number;
	overdueLent: number;
	totalContacts: number;
	repaymentRequests: number;
}

export interface ActionRequiredItem {
	type: 'pending_request' | 'repayment_request' | 'overdue_loan' | 'updated_transaction';
	transactionId: string;
	amount: number;
	currency: CurrencyData;
	otherParty: {
		name: string | null;
		email: string;
		image: string | null;
	};
	daysOverdue?: number;
	dueDate?: Date | null;
	status: TransactionStatusEnum;
	userRole: 'borrower' | 'lender';
	requestDate: Date;
}

export interface StatusDistribution {
	pending: number;
	accepted: number;
	partially_paid: number;
	completed: number;
	rejected: number;
	requested_repay: number;
}

export interface MonthlyActivityData {
	month: string;
	borrowed: number;
	lent: number;
}

export interface ChartData {
	statusDistributionAsBorrower: StatusDistribution;
	statusDistributionAsLender: StatusDistribution;
	monthlyActivity: MonthlyActivityData[];
}

export interface RecentTransaction {
	id: string;
	amount: number;
	currency: CurrencyData;
	status: TransactionStatusEnum;
	type: TransactionTypeEnum;
	otherParty: {
		name: string | null;
		email: string;
		image: string | null;
	};
	date: Date;
	dueDate?: Date | null;
	description?: string | null;
}

export interface UpcomingDueDate {
	id: string;
	amount: number;
	remainingAmount: number;
	currency: CurrencyData;
	dueDate: Date;
	type: TransactionTypeEnum;
	otherParty: {
		name: string | null;
		email: string;
		image: string | null;
	};
	daysUntilDue: number;
	urgency: 'high' | 'medium' | 'low';
	status: TransactionStatusEnum;
}

export interface OverviewResponse {
	metrics: MetricsData;
	actionRequired: ActionRequiredItem[];
	chartData: ChartData;
	recentTransactions: RecentTransaction[];
	upcomingDueDates: UpcomingDueDate[];
}
