import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from './app/auth/auth.module';
import { CryptoModule } from './core/crypto/crypto.module';
import { validateEnv } from './core/env';
import { CsrfModule } from './csrf/csrf.module';
import { TransactionsModule } from './app/transactions/transactions.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			validate: validateEnv,
		}),
		DiscoveryModule,
		CryptoModule,
		CsrfModule,
		DatabaseModule,
		AuthModule,
		TransactionsModule,
	],
	controllers: [],
})
export class AppModule {}
