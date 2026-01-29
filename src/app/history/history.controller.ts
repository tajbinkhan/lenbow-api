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
import { ApiResponse, createApiResponse } from '../../core/api-response.interceptor';
import { JwtAuthGuard } from '../auth/auth.guard';
import { TransactionHistoriesReturnType } from './@types/history.types';
import {
	transactionHistoryQuerySchema,
	type TransactionHistoryQuerySchemaType,
} from './history.schema';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
	constructor(private readonly historyService: HistoryService) {}

	@UseGuards(JwtAuthGuard)
	@Get('transactions')
	async getTransactionHistoryList(
		@Req() req: Request,
		@Query() query: TransactionHistoryQuerySchemaType,
	): Promise<ApiResponse<TransactionHistoriesReturnType[]>> {
		const userId = req.user?.id;

		const validate = transactionHistoryQuerySchema.safeParse(query);
		if (!validate.success) {
			throw new BadRequestException(
				`Validation failed: ${validate.error.issues.map(issue => issue.message).join(', ')}`,
			);
		}

		const transactions = await this.historyService.getTransactionHistory(validate.data, userId!);

		return createApiResponse(
			HttpStatus.OK,
			'Transaction list fetched successfully',
			transactions.data,
			transactions.pagination,
		);
	}
}
