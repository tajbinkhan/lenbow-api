import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import schema from '../database/schema';
import { currencies } from '../models/drizzle/currency.model';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

interface CurrencyData {
	code: string;
	name: string;
	symbol: string;
}

const currencyData: CurrencyData[] = [
	{
		code: 'USD',
		name: 'US Dollar',
		symbol: '$',
	},
	{
		code: 'BDT',
		name: 'Bangladeshi Taka',
		symbol: '৳',
	},
];

async function seedCurrencies() {
	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
	});

	const db = drizzle(pool, { schema });

	console.log('🌱 Starting currency seeding...');

	try {
		for (const currency of currencyData) {
			// Check if currency with this code already exists
			const existing = await db
				.select()
				.from(currencies)
				.where(eq(currencies.code, currency.code))
				.limit(1);

			if (existing.length > 0) {
				// Update existing currency
				await db
					.update(currencies)
					.set({
						...currency,
						updatedAt: new Date(),
					})
					.where(eq(currencies.code, currency.code));
				console.log(`🔄 Updated currency: ${currency.code}`);
			} else {
				// Insert new currency
				await db.insert(currencies).values(currency);
				console.log(`✅ Seeded currency: ${currency.code}`);
			}
		}

		console.log('✨ Currency seeding completed successfully!');
	} catch (error) {
		console.error('❌ Error seeding currencies:', error);
		throw error;
	} finally {
		await pool.end();
	}
}

// Run the seeder if executed directly
if (require.main === module) {
	seedCurrencies()
		.then(() => process.exit(0))
		.catch(error => {
			console.error(error);
			process.exit(1);
		});
}

export default seedCurrencies;
