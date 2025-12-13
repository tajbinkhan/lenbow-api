import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import createPool, { DATABASE_CONNECTION } from 'src/database/connection';

@Global()
@Module({
	imports: [ConfigModule],
	providers: [
		{
			provide: DATABASE_CONNECTION,
			useFactory: (configService: ConfigService) => createPool(configService),
			inject: [ConfigService],
		},
	],
	exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
