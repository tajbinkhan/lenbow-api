import { Module } from '@nestjs/common';
import { AuthModule } from 'src/app/auth/auth.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
	imports: [AuthModule],
	controllers: [TransactionsController],
	providers: [TransactionsService],
})
export class TransactionsModule {}
