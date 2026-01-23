import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpStatus,
	Put,
	Req,
	UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiResponse, createApiResponse } from '../../core/api-response.interceptor';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrencyData } from './@types/currency.types';
import { updateCurrency, type UpdateCurrencyDto } from './currency.schema';
import { CurrencyService } from './currency.service';

@Controller('currency')
export class CurrencyController {
	constructor(private readonly currencyService: CurrencyService) {}

	@UseGuards(JwtAuthGuard)
	@Get('')
	async getCurrencyList(): Promise<ApiResponse<CurrencyData[]>> {
		const data = await this.currencyService.getAllCurrencies();

		return createApiResponse(HttpStatus.OK, 'Currency list retrieved successfully', data);
	}

	@UseGuards(JwtAuthGuard)
	@Put('')
	async updateUserCurrency(
		@Body() body: UpdateCurrencyDto,
		@Req() req: Request,
	): Promise<ApiResponse<boolean>> {
		const userId = Number(req.user?.id);
		const validate = updateCurrency.safeParse(body);
		if (!validate.success) {
			throw new BadRequestException(validate.error.issues.map(issue => issue.message).join(', '));
		}

		await this.currencyService.addCurrencyToUser(userId, validate.data.currency);

		return createApiResponse(HttpStatus.OK, 'User currency updated successfully', true);
	}
}
