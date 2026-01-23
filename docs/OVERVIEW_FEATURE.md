# Overview (Dashboard) Feature Documentation

## Overview

The Overview feature provides a comprehensive dashboard view for users after login, displaying key
metrics, actionable items, charts, recent transactions, and upcoming due dates.

## Implementation Status

✅ **Phase 1 - Completed**

- Key metrics cards
- Action required section
- Recent transactions list
- Quick actions panel (data provided)

✅ **Phase 2 - Completed**

- Charts and visualizations (status distribution, monthly activity)
- Upcoming due dates calendar
- Advanced filtering

## API Endpoint

### GET `/overview`

**Authentication Required:** Yes (JWT)

**Query Parameters:**

- `recentLimit` (number, optional, default: 10) - Limit for recent transactions
- `upcomingLimit` (number, optional, default: 5) - Limit for upcoming due dates
- `actionRequiredLimit` (number, optional, default: 10) - Limit for action required items
- `monthsBack` (number, optional, default: 6) - Number of months for chart data

**Example Request:**

```bash
GET /overview?recentLimit=10&upcomingLimit=5&monthsBack=6
Authorization: Bearer <jwt_token>
```

**Response Structure:**

```typescript
{
  "statusCode": 200,
  "message": "Overview fetched successfully",
  "data": {
    "metrics": MetricsData,
    "actionRequired": ActionRequiredItem[],
    "chartData": ChartData,
    "recentTransactions": RecentTransaction[],
    "upcomingDueDates": UpcomingDueDate[]
  }
}
```

## Data Structures

### MetricsData

```typescript
{
	totalBorrowed: number; // Total outstanding amount user borrowed
	totalLent: number; // Total outstanding amount user lent
	pendingRequests: number; // Count of pending loan requests (as lender)
	overdueCount: number; // Total overdue loans count
	overdueBorrowed: number; // Overdue loans as borrower
	overdueLent: number; // Overdue loans as lender
	totalContacts: number; // Total connected contacts
	repaymentRequests: number; // Pending repayment requests (as lender)
}
```

**Business Rules:**

- `totalBorrowed`: Sum of `remainingAmount` where user is borrower and status is `accepted`,
  `partially_paid`, or `requested_repay`
- `totalLent`: Sum of `remainingAmount` where user is lender and status is `accepted`,
  `partially_paid`, or `requested_repay`
- `overdueCount`: Count where `dueDate < NOW()` and status is active
- `repaymentRequests`: Count where user is lender and status is `requested_repay`

### ActionRequiredItem

```typescript
{
  type: 'pending_request' | 'repayment_request' | 'overdue_loan' | 'updated_transaction';
  transactionId: string;          // Transaction public ID
  amount: number;
  currency: CurrencyData;
  otherParty: {
    name: string | null;
    email: string;
    image: string | null;
  };
  daysOverdue?: number;           // Only for overdue loans
  dueDate?: Date | null;
  status: TransactionStatusEnum;
  userRole: 'borrower' | 'lender';
  requestDate: Date;
}
```

**Action Types:**

- `pending_request`: Loan request awaiting approval (user is lender, status: pending)
- `repayment_request`: Borrower submitted repayment for review (user is lender, status:
  requested_repay)
- `overdue_loan`: Loan past due date (user is borrower or lender, dueDate < now)
- `updated_transaction`: Transaction terms updated (future implementation)

### ChartData

```typescript
{
  statusDistributionAsBorrower: {
    pending: number;
    accepted: number;
    partially_paid: number;
    completed: number;
    rejected: number;
    requested_repay: number;
  };
  statusDistributionAsLender: {
    pending: number;
    accepted: number;
    partially_paid: number;
    completed: number;
    rejected: number;
    requested_repay: number;
  };
  monthlyActivity: [
    {
      month: string;              // Format: 'YYYY-MM'
      borrowed: number;           // Total amount borrowed in this month
      lent: number;               // Total amount lent in this month
    }
  ];
}
```

**Chart Use Cases:**

- **Status Distribution**: Pie/Donut charts showing transaction breakdown by status
- **Monthly Activity**: Bar/Line chart showing loan volume trends over time

### RecentTransaction

```typescript
{
  id: string;                     // Transaction public ID
  amount: number;
  currency: CurrencyData;
  status: TransactionStatusEnum;
  type: 'borrow' | 'lend';
  otherParty: {
    name: string | null;
    email: string;
    image: string | null;
  };
  date: Date;                     // Request date
  dueDate?: Date | null;
  description?: string | null;
}
```

**Sorting:** Ordered by `requestDate` descending (most recent first)

### UpcomingDueDate

```typescript
{
	id: string; // Transaction public ID
	amount: number;
	remainingAmount: number;
	currency: CurrencyData;
	dueDate: Date;
	type: 'borrow' | 'lend';
	otherParty: {
		name: string | null;
		email: string;
		image: string | null;
	}
	daysUntilDue: number;
	urgency: 'high' | 'medium' | 'low';
	status: TransactionStatusEnum;
}
```

**Urgency Levels:**

- `high`: ≤ 3 days until due
- `medium`: 4-7 days until due
- `low`: > 7 days until due

**Filter:** Only includes transactions with due dates in the next 30 days

## Database Queries

### Performance Optimizations

1. **Parallel Execution**: All 5 data sections fetched concurrently using `Promise.all()`
2. **Indexed Fields**: Queries leverage existing indexes on:
   - `transactions.borrowerId`
   - `transactions.lenderId`
   - `transactions.status`
   - `transactions.dueDate`
3. **SQL Aggregations**: Use database-level `SUM()` and `COUNT()` for efficiency
4. **Joins**: Uses `INNER JOIN` with user table for contact information
5. **Aliases**: Uses SQL aliases (`lender_user`) to join users table twice

### Query Patterns

**Metrics Query Example:**

```sql
SELECT COALESCE(SUM(remaining_amount), 0) as total
FROM transactions
WHERE borrower_id = $userId
  AND status IN ('accepted', 'partially_paid', 'requested_repay')
```

**Monthly Activity Query:**

```sql
SELECT
  TO_CHAR(request_date, 'YYYY-MM') as month,
  COALESCE(SUM(CASE WHEN borrower_id = $userId THEN amount ELSE 0 END), 0) as borrowed,
  COALESCE(SUM(CASE WHEN lender_id = $userId THEN amount ELSE 0 END), 0) as lent
FROM transactions
WHERE request_date >= $startDate
  AND (borrower_id = $userId OR lender_id = $userId)
GROUP BY TO_CHAR(request_date, 'YYYY-MM')
ORDER BY month
```

## Frontend Integration Guide

### 1. Key Metrics Cards (Top Section)

Display in a grid layout (responsive):

```typescript
<MetricsCard
  title="Total Borrowed"
  value={formatCurrency(metrics.totalBorrowed, userCurrency)}
  icon="borrow"
/>
<MetricsCard
  title="Total Lent"
  value={formatCurrency(metrics.totalLent, userCurrency)}
  icon="lend"
/>
<MetricsCard
  title="Pending Requests"
  value={metrics.pendingRequests}
  badge={metrics.pendingRequests > 0}
  icon="pending"
/>
<MetricsCard
  title="Overdue"
  value={metrics.overdueCount}
  urgent={metrics.overdueCount > 0}
  icon="warning"
/>
```

### 2. Action Required Section

Priority-based alerts requiring user interaction:

```typescript
{actionRequired.map(action => (
  <ActionCard
    type={action.type}
    transaction={action.transactionId}
    amount={formatCurrency(action.amount, action.currency)}
    otherParty={action.otherParty.name || action.otherParty.email}
    daysOverdue={action.daysOverdue}
    onClick={() => navigateToTransaction(action.transactionId)}
  />
))}
```

**Action Colors:**

- `pending_request`: Blue/Info
- `repayment_request`: Purple/Primary
- `overdue_loan`: Red/Danger
- `updated_transaction`: Orange/Warning

### 3. Charts (Visualizations)

**Status Distribution Pie Chart:**

```typescript
<PieChart
  data={[
    { name: 'Pending', value: chartData.statusDistributionAsBorrower.pending },
    { name: 'Accepted', value: chartData.statusDistributionAsBorrower.accepted },
    { name: 'Partially Paid', value: chartData.statusDistributionAsBorrower.partially_paid },
    { name: 'Completed', value: chartData.statusDistributionAsBorrower.completed },
  ]}
  title="Loans as Borrower"
/>
```

**Monthly Activity Bar Chart:**

```typescript
<BarChart
  data={chartData.monthlyActivity}
  xAxisKey="month"
  bars={[
    { dataKey: "borrowed", fill: "#ef4444", name: "Borrowed" },
    { dataKey: "lent", fill: "#10b981", name: "Lent" }
  ]}
  title="Last 6 Months Activity"
/>
```

### 4. Recent Transactions List

```typescript
<TransactionList>
  {recentTransactions.map(tx => (
    <TransactionRow
      id={tx.id}
      amount={formatCurrency(tx.amount, tx.currency)}
      status={tx.status}
      type={tx.type}
      otherParty={tx.otherParty}
      date={formatDate(tx.date)}
      onClick={() => navigateToTransaction(tx.id)}
    />
  ))}
</TransactionList>
```

### 5. Upcoming Due Dates Calendar

```typescript
<DueDateList>
  {upcomingDueDates.map(item => (
    <DueDateCard
      id={item.id}
      amount={formatCurrency(item.remainingAmount, item.currency)}
      dueDate={formatDate(item.dueDate)}
      daysUntilDue={item.daysUntilDue}
      urgency={item.urgency}
      otherParty={item.otherParty}
      type={item.type}
    />
  ))}
</DueDateList>
```

**Urgency Styling:**

- High: Red background, pulsing animation
- Medium: Yellow/Orange background
- Low: Green/Neutral background

## Testing

### Test Scenarios

1. **Empty State**: New user with no transactions
   - All metrics should be 0
   - Empty arrays for lists
   - Graceful UI handling

2. **As Borrower**: User with multiple loans
   - Verify `totalBorrowed` calculation
   - Check overdue loans display correctly
   - Upcoming due dates show borrower perspective

3. **As Lender**: User lending money
   - Verify `totalLent` calculation
   - Check pending requests appear
   - Repayment requests shown

4. **Mixed Role**: User both borrowing and lending
   - Correct separation of metrics
   - Action required shows both types
   - Charts display both distributions

5. **Query Parameters**: Test custom limits
   - Verify `recentLimit` works
   - Check `monthsBack` affects chart data
   - Validate default values

## Error Handling

The endpoint handles:

- ❌ Unauthenticated requests → 401 Unauthorized
- ❌ Invalid query parameters → 400 Bad Request with validation errors
- ❌ Database errors → 500 Internal Server Error (logged)
- ✅ Missing data → Returns empty arrays/zero values (graceful degradation)

## Performance Considerations

**Expected Response Times:**

- User with < 100 transactions: < 200ms
- User with < 1000 transactions: < 500ms
- User with > 1000 transactions: < 1s

**Optimization Strategies:**

1. Consider caching metrics for high-traffic users
2. Add database query timeout limits
3. Implement pagination for action required items if needed
4. Consider Redis caching for frequently accessed data

## Future Enhancements (Phase 3)

- [ ] Historical trends and year-over-year comparisons
- [ ] Predictive analytics (estimated payoff dates)
- [ ] Export/download reports (PDF, CSV)
- [ ] Customizable dashboard widgets
- [ ] Real-time updates via WebSockets
- [ ] Email digest of dashboard summary
- [ ] Mobile push notifications for action required items
- [ ] Advanced filtering by currency, date ranges, contacts
- [ ] Dashboard presets (borrower view, lender view, complete view)

## Files Structure

```
src/app/overview/
├── @types/
│   └── overview.types.ts       # TypeScript interfaces
├── overview.controller.ts      # API endpoint handler
├── overview.service.ts         # Business logic and database queries
├── overview.schema.ts          # Validation schemas
└── overview.module.ts          # NestJS module configuration
```

## Dependencies

- `@nestjs/common`: Core NestJS framework
- `drizzle-orm`: Database ORM for queries
- `zod`: Schema validation
- Database: PostgreSQL with existing transaction schema

## Related Features

- **Transactions**: Source of all transaction data
- **Contacts**: User relationship data
- **Currency**: Multi-currency support
- **Auth**: User authentication and identification

## Support

For issues or questions, refer to:

- [Project Technical Documentation](./PROJECT_TECHNICAL_DOCUMENTATION.md)
- [Transaction Schema](../models/drizzle/transactions.model.ts)
- [API Response Format](../core/api-response.interceptor.ts)
