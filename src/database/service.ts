import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from './connection';
import schema from './schema';

// Define the transaction type
type DrizzleTransaction = Parameters<
	Parameters<NodePgDatabase<typeof schema>['transaction']>[0]
>[0];

export default abstract class DrizzleService {
	protected db: NodePgDatabase<typeof schema>;
	private currentTx: DrizzleTransaction | null = null;

	constructor(
		@Inject(DATABASE_CONNECTION)
		database: NodePgDatabase<typeof schema>,
	) {
		this.db = database;
	}

	// Set transaction context for the service instance
	setTransaction(tx: DrizzleTransaction): this {
		this.currentTx = tx;
		return this;
	}

	// Clear transaction context
	clearTransaction(): this {
		this.currentTx = null;
		return this;
	}

	// Get the appropriate database connection
	protected getDb(): NodePgDatabase<typeof schema> | DrizzleTransaction {
		return this.currentTx || this.db;
	}
}
