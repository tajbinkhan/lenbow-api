import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthModule } from './app/auth/auth.module';
import { BrevoModule } from './app/brevo/brevo.module';
import { ContactsModule } from './app/contacts/contacts.module';
import { CurrencyModule } from './app/currency/currency.module';
import { HistoryModule } from './app/history/history.module';
import { MediaModule } from './app/media/media.module';
import { OverviewModule } from './app/overview/overview.module';
import { TemplateModule } from './app/template/template.module';
import { TransactionsModule } from './app/transactions/transactions.module';
import { CryptoModule } from './core/crypto/crypto.module';
import { validateEnv } from './core/env';
import { CsrfModule } from './csrf/csrf.module';
import { DatabaseModule } from './database/database.module';

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
		ContactsModule,
		HistoryModule,
		BrevoModule,
		TemplateModule,
		CurrencyModule,
		OverviewModule,
		MediaModule,
	],
	controllers: [AppController],
})
export class AppModule {}
