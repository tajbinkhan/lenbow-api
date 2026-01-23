import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../../database/connection';
import schema from '../../database/schema';
import DrizzleService from '../../database/service';
import { CurrencySchemaType, UserSchemaType } from '../../database/types';
import { CurrencyData } from './@types/currency.types';

@Injectable()
export class CurrencyService extends DrizzleService {
	constructor(
		@Inject(DATABASE_CONNECTION)
		db: NodePgDatabase<typeof schema>,
	) {
		super(db);
	}

	async getAllCurrencies(): Promise<CurrencyData[]> {
		const response = await this.getDb()
			.select({
				symbol: schema.currencies.symbol,
				name: schema.currencies.name,
				code: schema.currencies.code,
			})
			.from(schema.currencies)
			.orderBy(schema.currencies.name);

		return response;
	}

	async addCurrencyToUser(userId: number, code: string): Promise<UserSchemaType> {
		const response = await this.getDb()
			.update(schema.users)
			.set({ currencyCode: code })
			.where(eq(schema.users.id, userId))
			.returning()
			.then(res => res[0]);

		return response;
	}

	async getCurrencyByCode(code: string): Promise<CurrencySchemaType> {
		const response = await this.getDb().query.currencies.findFirst({
			where: eq(schema.currencies.code, code),
		});

		if (!response) throw new NotFoundException(`Currency with code ${code} not found`);

		return response;
	}
}
