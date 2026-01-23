import {
	BadRequestException,
	Controller,
	Get,
	HttpStatus,
	Query,
	Req,
	UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { createApiResponse, type ApiResponse } from '../../core/api-response.interceptor';
import { JwtAuthGuard } from '../auth/auth.guard';
import type { OverviewResponse } from './@types/overview.types';
import { overviewQuerySchema, type OverviewQuerySchemaType } from './overview.schema';
import { OverviewService } from './overview.service';

@Controller('overview')
export class OverviewController {
	constructor(private readonly overviewService: OverviewService) {}

	@UseGuards(JwtAuthGuard)
	@Get('')
	async getOverview(
		@Req() req: Request,
		@Query() query: OverviewQuerySchemaType,
	): Promise<ApiResponse<OverviewResponse>> {
		const userId = req.user?.id;

		if (!userId) {
			throw new BadRequestException('User not authenticated');
		}

		const validate = overviewQuerySchema.safeParse(query);
		if (!validate.success) {
			throw new BadRequestException(
				`Validation failed: ${validate.error.issues.map(issue => issue.message).join(', ')}`,
			);
		}

		const overview = await this.overviewService.getOverview(userId, validate.data);

		return createApiResponse(HttpStatus.OK, 'Overview fetched successfully', overview);
	}
}
