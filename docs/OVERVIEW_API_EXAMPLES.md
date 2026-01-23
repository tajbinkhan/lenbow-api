# Overview API Response Example

This file contains example responses from the `/overview` endpoint for different user scenarios.

## Example 1: Active User (Mixed Borrower/Lender)

**Request:**

```bash
GET /overview?recentLimit=5&upcomingLimit=3
Authorization: Bearer eyJhbGc...
```

**Response:**

```json
{
	"statusCode": 200,
	"message": "Overview fetched successfully",
	"data": {
		"metrics": {
			"totalBorrowed": 1500.0,
			"totalLent": 3200.0,
			"pendingRequests": 2,
			"overdueCount": 1,
			"overdueBorrowed": 1,
			"overdueLent": 0,
			"totalContacts": 8,
			"repaymentRequests": 1
		},
		"actionRequired": [
			{
				"type": "overdue_loan",
				"transactionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
				"amount": 500.0,
				"currency": {
					"code": "USD",
					"name": "US Dollar",
					"symbol": "$"
				},
				"otherParty": {
					"name": "John Doe",
					"email": "john@example.com",
					"image": "https://example.com/avatar.jpg"
				},
				"daysOverdue": 5,
				"dueDate": "2026-01-18T00:00:00.000Z",
				"status": "accepted",
				"userRole": "borrower",
				"requestDate": "2026-01-01T10:30:00.000Z"
			},
			{
				"type": "repayment_request",
				"transactionId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
				"amount": 800.0,
				"currency": {
					"code": "EUR",
					"name": "Euro",
					"symbol": "€"
				},
				"otherParty": {
					"name": "Jane Smith",
					"email": "jane@example.com",
					"image": null
				},
				"dueDate": "2026-02-01T00:00:00.000Z",
				"status": "requested_repay",
				"userRole": "lender",
				"requestDate": "2026-01-10T14:20:00.000Z"
			},
			{
				"type": "pending_request",
				"transactionId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
				"amount": 1200.0,
				"currency": {
					"code": "USD",
					"name": "US Dollar",
					"symbol": "$"
				},
				"otherParty": {
					"name": "Bob Johnson",
					"email": "bob@example.com",
					"image": "https://example.com/bob.jpg"
				},
				"dueDate": "2026-03-01T00:00:00.000Z",
				"status": "pending",
				"userRole": "lender",
				"requestDate": "2026-01-20T09:15:00.000Z"
			}
		],
		"chartData": {
			"statusDistributionAsBorrower": {
				"pending": 2,
				"accepted": 3,
				"partially_paid": 1,
				"completed": 5,
				"rejected": 1,
				"requested_repay": 0
			},
			"statusDistributionAsLender": {
				"pending": 2,
				"accepted": 4,
				"partially_paid": 2,
				"completed": 8,
				"rejected": 0,
				"requested_repay": 1
			},
			"monthlyActivity": [
				{
					"month": "2025-08",
					"borrowed": 500.0,
					"lent": 1200.0
				},
				{
					"month": "2025-09",
					"borrowed": 800.0,
					"lent": 600.0
				},
				{
					"month": "2025-10",
					"borrowed": 0,
					"lent": 1500.0
				},
				{
					"month": "2025-11",
					"borrowed": 1200.0,
					"lent": 800.0
				},
				{
					"month": "2025-12",
					"borrowed": 600.0,
					"lent": 2000.0
				},
				{
					"month": "2026-01",
					"borrowed": 1500.0,
					"lent": 1200.0
				}
			]
		},
		"recentTransactions": [
			{
				"id": "d4e5f6a7-b8c9-0123-def1-234567890123",
				"amount": 1500.0,
				"currency": {
					"code": "USD",
					"name": "US Dollar",
					"symbol": "$"
				},
				"status": "accepted",
				"type": "borrow",
				"otherParty": {
					"name": "Alice Brown",
					"email": "alice@example.com",
					"image": "https://example.com/alice.jpg"
				},
				"date": "2026-01-22T08:30:00.000Z",
				"dueDate": "2026-02-22T00:00:00.000Z",
				"description": "Emergency medical expenses"
			},
			{
				"id": "e5f6a7b8-c9d0-1234-ef12-345678901234",
				"amount": 800.0,
				"currency": {
					"code": "EUR",
					"name": "Euro",
					"symbol": "€"
				},
				"status": "requested_repay",
				"type": "lend",
				"otherParty": {
					"name": "Jane Smith",
					"email": "jane@example.com",
					"image": null
				},
				"date": "2026-01-20T14:20:00.000Z",
				"dueDate": "2026-02-01T00:00:00.000Z",
				"description": "Car repair"
			},
			{
				"id": "f6a7b8c9-d0e1-2345-f123-456789012345",
				"amount": 500.0,
				"currency": {
					"code": "GBP",
					"name": "British Pound",
					"symbol": "£"
				},
				"status": "completed",
				"type": "borrow",
				"otherParty": {
					"name": "Charlie Wilson",
					"email": "charlie@example.com",
					"image": "https://example.com/charlie.jpg"
				},
				"date": "2026-01-15T11:45:00.000Z",
				"dueDate": "2026-02-15T00:00:00.000Z",
				"description": "Rent assistance"
			},
			{
				"id": "a7b8c9d0-e1f2-3456-1234-567890123456",
				"amount": 2000.0,
				"currency": {
					"code": "USD",
					"name": "US Dollar",
					"symbol": "$"
				},
				"status": "partially_paid",
				"type": "lend",
				"otherParty": {
					"name": "David Lee",
					"email": "david@example.com",
					"image": null
				},
				"date": "2026-01-10T16:00:00.000Z",
				"dueDate": "2026-03-10T00:00:00.000Z",
				"description": "Business investment"
			},
			{
				"id": "b8c9d0e1-f2a3-4567-2345-678901234567",
				"amount": 300.0,
				"currency": {
					"code": "USD",
					"name": "US Dollar",
					"symbol": "$"
				},
				"status": "rejected",
				"type": "borrow",
				"otherParty": {
					"name": "Emma Davis",
					"email": "emma@example.com",
					"image": "https://example.com/emma.jpg"
				},
				"date": "2026-01-05T09:20:00.000Z",
				"dueDate": null,
				"description": "Personal loan"
			}
		],
		"upcomingDueDates": [
			{
				"id": "c9d0e1f2-a3b4-5678-3456-789012345678",
				"amount": 1000.0,
				"remainingAmount": 1000.0,
				"currency": {
					"code": "USD",
					"name": "US Dollar",
					"symbol": "$"
				},
				"dueDate": "2026-01-25T00:00:00.000Z",
				"type": "lend",
				"otherParty": {
					"name": "Frank Miller",
					"email": "frank@example.com",
					"image": null
				},
				"daysUntilDue": 2,
				"urgency": "high",
				"status": "accepted"
			},
			{
				"id": "d0e1f2a3-b4c5-6789-4567-890123456789",
				"amount": 1500.0,
				"remainingAmount": 750.0,
				"currency": {
					"code": "EUR",
					"name": "Euro",
					"symbol": "€"
				},
				"dueDate": "2026-01-29T00:00:00.000Z",
				"type": "borrow",
				"otherParty": {
					"name": "Grace Taylor",
					"email": "grace@example.com",
					"image": "https://example.com/grace.jpg"
				},
				"daysUntilDue": 6,
				"urgency": "medium",
				"status": "partially_paid"
			},
			{
				"id": "e1f2a3b4-c5d6-7890-5678-901234567890",
				"amount": 2500.0,
				"remainingAmount": 2500.0,
				"currency": {
					"code": "USD",
					"name": "US Dollar",
					"symbol": "$"
				},
				"dueDate": "2026-02-10T00:00:00.000Z",
				"type": "lend",
				"otherParty": {
					"name": "Henry Anderson",
					"email": "henry@example.com",
					"image": "https://example.com/henry.jpg"
				},
				"daysUntilDue": 18,
				"urgency": "low",
				"status": "accepted"
			}
		]
	}
}
```

## Example 2: New User (Empty State)

**Request:**

```bash
GET /overview
Authorization: Bearer eyJhbGc...
```

**Response:**

```json
{
	"statusCode": 200,
	"message": "Overview fetched successfully",
	"data": {
		"metrics": {
			"totalBorrowed": 0,
			"totalLent": 0,
			"pendingRequests": 0,
			"overdueCount": 0,
			"overdueBorrowed": 0,
			"overdueLent": 0,
			"totalContacts": 0,
			"repaymentRequests": 0
		},
		"actionRequired": [],
		"chartData": {
			"statusDistributionAsBorrower": {
				"pending": 0,
				"accepted": 0,
				"partially_paid": 0,
				"completed": 0,
				"rejected": 0,
				"requested_repay": 0
			},
			"statusDistributionAsLender": {
				"pending": 0,
				"accepted": 0,
				"partially_paid": 0,
				"completed": 0,
				"rejected": 0,
				"requested_repay": 0
			},
			"monthlyActivity": []
		},
		"recentTransactions": [],
		"upcomingDueDates": []
	}
}
```

## Example 3: Pure Borrower

**Request:**

```bash
GET /overview?recentLimit=3
Authorization: Bearer eyJhbGc...
```

**Response:**

```json
{
	"statusCode": 200,
	"message": "Overview fetched successfully",
	"data": {
		"metrics": {
			"totalBorrowed": 2500.0,
			"totalLent": 0,
			"pendingRequests": 0,
			"overdueCount": 0,
			"overdueBorrowed": 0,
			"overdueLent": 0,
			"totalContacts": 3,
			"repaymentRequests": 0
		},
		"actionRequired": [],
		"chartData": {
			"statusDistributionAsBorrower": {
				"pending": 1,
				"accepted": 2,
				"partially_paid": 1,
				"completed": 3,
				"rejected": 0,
				"requested_repay": 0
			},
			"statusDistributionAsLender": {
				"pending": 0,
				"accepted": 0,
				"partially_paid": 0,
				"completed": 0,
				"rejected": 0,
				"requested_repay": 0
			},
			"monthlyActivity": [
				{
					"month": "2025-11",
					"borrowed": 1000.0,
					"lent": 0
				},
				{
					"month": "2025-12",
					"borrowed": 500.0,
					"lent": 0
				},
				{
					"month": "2026-01",
					"borrowed": 1500.0,
					"lent": 0
				}
			]
		},
		"recentTransactions": [
			{
				"id": "f2a3b4c5-d6e7-8901-6789-012345678901",
				"amount": 1500.0,
				"currency": {
					"code": "USD",
					"name": "US Dollar",
					"symbol": "$"
				},
				"status": "accepted",
				"type": "borrow",
				"otherParty": {
					"name": "Sarah Johnson",
					"email": "sarah@example.com",
					"image": null
				},
				"date": "2026-01-20T10:00:00.000Z",
				"dueDate": "2026-03-20T00:00:00.000Z",
				"description": "Business startup costs"
			},
			{
				"id": "a3b4c5d6-e7f8-9012-7890-123456789012",
				"amount": 500.0,
				"currency": {
					"code": "USD",
					"name": "US Dollar",
					"symbol": "$"
				},
				"status": "completed",
				"type": "borrow",
				"otherParty": {
					"name": "Michael Chen",
					"email": "michael@example.com",
					"image": "https://example.com/michael.jpg"
				},
				"date": "2025-12-15T14:30:00.000Z",
				"dueDate": "2026-01-15T00:00:00.000Z",
				"description": "Holiday expenses"
			},
			{
				"id": "b4c5d6e7-f8a9-0123-8901-234567890123",
				"amount": 1000.0,
				"currency": {
					"code": "USD",
					"name": "US Dollar",
					"symbol": "$"
				},
				"status": "partially_paid",
				"type": "borrow",
				"otherParty": {
					"name": "Lisa Martinez",
					"email": "lisa@example.com",
					"image": "https://example.com/lisa.jpg"
				},
				"date": "2025-11-10T08:45:00.000Z",
				"dueDate": "2026-02-10T00:00:00.000Z",
				"description": "Medical bills"
			}
		],
		"upcomingDueDates": [
			{
				"id": "c5d6e7f8-a9b0-1234-9012-345678901234",
				"amount": 1000.0,
				"remainingAmount": 500.0,
				"currency": {
					"code": "USD",
					"name": "US Dollar",
					"symbol": "$"
				},
				"dueDate": "2026-02-10T00:00:00.000Z",
				"type": "borrow",
				"otherParty": {
					"name": "Lisa Martinez",
					"email": "lisa@example.com",
					"image": "https://example.com/lisa.jpg"
				},
				"daysUntilDue": 18,
				"urgency": "low",
				"status": "partially_paid"
			}
		]
	}
}
```

## Example 4: Error Response (Invalid Query)

**Request:**

```bash
GET /overview?recentLimit=-5
Authorization: Bearer eyJhbGc...
```

**Response:**

```json
{
	"statusCode": 400,
	"message": "Validation failed: Recent Limit must be a positive number",
	"data": null
}
```

## Example 5: Error Response (Unauthorized)

**Request:**

```bash
GET /overview
```

**Response:**

```json
{
	"statusCode": 401,
	"message": "Unauthorized",
	"data": null
}
```

## Frontend Usage Examples

### React Hook Example

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useOverview(options = {}) {
  return useQuery({
    queryKey: ['overview', options],
    queryFn: () => api.get('/overview', { params: options }),
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}

// Usage in component
function DashboardPage() {
  const { data, isLoading, error } = useOverview({
    recentLimit: 10,
    upcomingLimit: 5,
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <MetricsGrid metrics={data.metrics} />
      <ActionRequiredList items={data.actionRequired} />
      <ChartsSection data={data.chartData} />
      <RecentTransactions transactions={data.recentTransactions} />
      <UpcomingDueDates dueDates={data.upcomingDueDates} />
    </div>
  );
}
```

### Currency Formatting Helper

```typescript
export function formatCurrency(amount: number, currency: { symbol: string; code: string }): string {
	return `${currency.symbol}${amount.toFixed(2)}`;
}

// Usage
formatCurrency(1500.5, { symbol: '$', code: 'USD' }); // "$1500.50"
```

### Date Formatting Helper

```typescript
export function formatRelativeDate(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return 'Yesterday';
	if (diffDays < 7) return `${diffDays} days ago`;
	if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
	return date.toLocaleDateString();
}
```
