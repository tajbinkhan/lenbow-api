import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

@Module({
	imports: [DatabaseModule],
	controllers: [OverviewController],
	providers: [OverviewService],
	exports: [OverviewService],
})
export class OverviewModule {}
