import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import schema from '../database/schema';
import { emailTemplates } from '../models/drizzle/template.model';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

interface TemplateData {
	key: string;
	version: number;
	name: string;
	description: string;
	subject: string;
	html: string;
	text?: string;
}

const templates: TemplateData[] = [
	{
		key: 'request_send',
		version: 1,
		name: 'Loan Request Send',
		description:
			'Email sent to user when their loan request is received (deprecated - use specific templates)',
		subject: '{{borrowerName}} requested loan from you',
		html: fs.readFileSync(path.join(__dirname, '../templates/requests-send.html'), 'utf-8'),
	},
	{
		key: 'loan_request_from_borrower',
		version: 1,
		name: 'Loan Request from Borrower',
		description: 'Email sent to lender when borrower requests to borrow money',
		subject: '{{borrowerName}} wants to borrow money from you',
		html: fs.readFileSync(
			path.join(__dirname, '../templates/loan-request-from-borrower.html'),
			'utf-8',
		),
	},
	{
		key: 'loan_offer_from_lender',
		version: 1,
		name: 'Loan Offer from Lender',
		description: 'Email sent to borrower when lender offers to lend money',
		subject: '{{lenderName}} is offering to lend you money',
		html: fs.readFileSync(
			path.join(__dirname, '../templates/loan-offer-from-lender.html'),
			'utf-8',
		),
	},
	{
		key: 'request_approved',
		version: 1,
		name: 'Loan Request Approved',
		description: 'Email sent to user when their loan request is approved',
		subject: 'Your Loan Request Has Been Approved',
		html: fs.readFileSync(path.join(__dirname, '../templates/requests-approved.html'), 'utf-8'),
	},
	{
		key: 'request_rejected',
		version: 1,
		name: 'Loan Request Rejected',
		description: 'Email sent to user when their loan request is rejected',
		subject: 'Your Loan Request Status Update',
		html: fs.readFileSync(path.join(__dirname, '../templates/requests-rejected.html'), 'utf-8'),
	},
	{
		key: 'repayment_requested',
		version: 1,
		name: 'Repayment Requested',
		description: 'Email sent to lender when borrower requests to repay',
		subject: '{{borrowerName}} wants to repay the loan',
		html: fs.readFileSync(path.join(__dirname, '../templates/repayment-requested.html'), 'utf-8'),
	},
	{
		key: 'repayment_accepted',
		version: 1,
		name: 'Repayment Accepted',
		description: 'Email sent to borrower when their repayment is accepted',
		subject: 'Your Repayment Has Been Accepted',
		html: fs.readFileSync(path.join(__dirname, '../templates/repayment-accepted.html'), 'utf-8'),
	},
	{
		key: 'repayment_rejected',
		version: 1,
		name: 'Repayment Rejected',
		description: 'Email sent to borrower when their repayment is rejected',
		subject: 'Your Repayment Needs Attention',
		html: fs.readFileSync(path.join(__dirname, '../templates/repayment-rejected.html'), 'utf-8'),
	},
	{
		key: 'repayment_completed',
		version: 1,
		name: 'Loan Completed',
		description: 'Email sent to borrower when loan is fully repaid and completed',
		subject: 'Congratulations! Loan Fully Repaid',
		html: fs.readFileSync(path.join(__dirname, '../templates/repayment-completed.html'), 'utf-8'),
	},
	{
		key: 'repayment_completed_lender',
		version: 1,
		name: 'Loan Completed - Lender',
		description: 'Email sent to lender when loan is fully repaid and completed',
		subject: 'Payment Received - Loan Fully Repaid',
		html: fs.readFileSync(
			path.join(__dirname, '../templates/loan-repayment-completed-lender.html'),
			'utf-8',
		),
	},
	{
		key: 'transaction_updated',
		version: 1,
		name: 'Transaction Updated',
		description: 'Email sent to lender when borrower updates transaction details',
		subject: 'Transaction Updated by {{updatedByName}}',
		html: fs.readFileSync(path.join(__dirname, '../templates/transaction-updated.html'), 'utf-8'),
	},
];

async function seedTemplates() {
	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
	});

	const db = drizzle(pool, { schema });

	console.log('🌱 Starting email template seeding...');

	try {
		for (const template of templates) {
			// Check if template with this key already exists
			const existing = await db
				.select()
				.from(emailTemplates)
				.where(eq(emailTemplates.key, template.key))
				.limit(1);

			if (existing.length > 0) {
				// Update existing template
				await db
					.update(emailTemplates)
					.set({
						...template,
						updatedAt: new Date(),
					})
					.where(eq(emailTemplates.key, template.key));
				console.log(`🔄 Updated template: ${template.key}`);
			} else {
				// Insert new template
				await db.insert(emailTemplates).values(template);
				console.log(`✅ Seeded template: ${template.key}`);
			}
		}

		console.log('✨ Email template seeding completed successfully!');
	} catch (error) {
		console.error('❌ Error seeding templates:', error);
		throw error;
	} finally {
		await pool.end();
	}
}

// Run the seeder if executed directly
if (require.main === module) {
	seedTemplates()
		.then(() => process.exit(0))
		.catch(error => {
			console.error(error);
			process.exit(1);
		});
}

export default seedTemplates;
