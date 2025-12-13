import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import schema from './schema';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

export default function createPool(configService: ConfigService) {
	const pool = new Pool({
		connectionString: configService.getOrThrow('DATABASE_URL'),
	});
	return drizzle(pool, { schema });
}
