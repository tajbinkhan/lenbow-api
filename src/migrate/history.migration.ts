import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import schema from '../database/schema';
import { transactionHistories, transactionOldHistories } from '../models/drizzle/history.model';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

async function migrateHistoryData() {
	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
	});

	const db = drizzle(pool, { schema });

	console.log('🔄 Starting history data migration...');
	console.log('📊 Migrating from transactionOldHistories to transactionHistories...');

	try {
		// Fetch all old history records
		const oldHistories = await db.select().from(transactionOldHistories);

		if (oldHistories.length === 0) {
			console.log('ℹ️  No records found in transactionOldHistories to migrate.');
			return;
		}

		console.log(`📦 Found ${oldHistories.length} records to migrate...`);

		let successCount = 0;
		let skippedCount = 0;
		let errorCount = 0;

		for (const history of oldHistories) {
			try {
				// Skip if this history record has already been migrated
				const existing = await db
					.select()
					.from(transactionHistories)
					.where(eq(transactionHistories.publicId, history.publicId))
					.limit(1);

				if (existing.length > 0) {
					console.log(`⏭️  Skipped: History ${history.publicId} already migrated`);
					skippedCount++;
					continue;
				}

				// Get the transaction details from the details field
				const details = history.details;

				// Validate required fields exist in details
				if (!details.borrowerId || !details.lenderId) {
					console.warn(
						`⚠️  Warning: Missing borrowerId or lenderId for history ${history.publicId}`,
					);
					errorCount++;
					continue;
				}

				// Prepare new history record
				const newHistoryData = {
					publicId: history.publicId,
					transactionId: history.transactionId,
					transactionPublicId: details.id,
					borrowerId: details.borrowerId,
					lenderId: details.lenderId,
					currency: details.currency || {
						code: 'BDT',
						name: 'Bangladeshi Taka',
						symbol: '৳',
					},
					amount: details.amount || 0,
					amountPaid: details.amountPaid || 0,
					remainingAmount: details.remainingAmount || details.amount - (details.amountPaid || 0),
					reviewAmount: details.reviewAmount || 0,
					status: details.status || 'pending',
					description: details.description || null,
					rejectionReason: details.rejectionReason || null,
					dueDate: details.dueDate ? new Date(details.dueDate) : null,
					requestDate: details.requestDate ? new Date(details.requestDate) : new Date(),
					acceptedAt: details.acceptedAt ? new Date(details.acceptedAt) : null,
					completedAt: details.completedAt ? new Date(details.completedAt) : null,
					rejectedAt: details.rejectedAt ? new Date(details.rejectedAt) : null,
					action: history.action,
					details: history.details,
					occurredAt: history.occurredAt,
					createdAt: history.createdAt,
					updatedAt: history.updatedAt,
				};

				// Insert into new table
				await db.insert(transactionHistories).values(newHistoryData);

				console.log(`✅ Migrated: History ${history.publicId} (Action: ${history.action})`);
				successCount++;
			} catch (error) {
				console.error(`❌ Error migrating history ${history.publicId}:`, error.message);
				errorCount++;
			}
		}

		console.log('\n📈 Migration Summary:');
		console.log(`   ✅ Successfully migrated: ${successCount} records`);
		console.log(`   ⏭️  Skipped (already exist): ${skippedCount} records`);
		console.log(`   ❌ Failed: ${errorCount} records`);
		console.log(`   📊 Total processed: ${oldHistories.length} records`);

		if (successCount > 0) {
			console.log('\n✨ History data migration completed successfully!');
		} else {
			console.log('\n⚠️  Migration completed but no new records were migrated.');
		}
	} catch (error) {
		console.error('❌ Error during migration:', error);
		throw error;
	} finally {
		await pool.end();
	}
}

// Run the migration if executed directly
if (require.main === module) {
	migrateHistoryData()
		.then(() => process.exit(0))
		.catch(error => {
			console.error(error);
			process.exit(1);
		});
}

export default migrateHistoryData;
