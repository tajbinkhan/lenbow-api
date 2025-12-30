import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	Req,
	UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from 'src/app/auth/auth.guard';
import type {
	TransactionListReturnType,
	TransactionReturnType,
} from 'src/app/transactions/@types/transactions.types';
import {
	transactionQuerySchema,
	validateTransactionSchema,
	type TransactionQuerySchemaType,
	type ValidateDeleteTransactionDto,
	type ValidateTransactionDto,
	type ValidateUpdateTransactionDto,
} from 'src/app/transactions/transactions.schema';
import { createApiResponse, type ApiResponse } from 'src/core/api-response.interceptor';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
	constructor(private readonly transactionsService: TransactionsService) {}

	// @UseGuards(JwtAuthGuard)
	// @Get('')
	// async getTransactionList(
	// 	@Req() req: Request,
	// 	@Query() query: TransactionQuerySchemaType,
	// ): Promise<ApiResponse<TransactionListReturnType[]>> {
	// 	const userId = req.user?.id;

	// 	const validate = transactionQuerySchema.safeParse(query);
	// 	if (!validate.success) {
	// 		throw new BadRequestException(
	// 			`Validation failed: ${validate.error.issues.map(issue => issue.message).join(', ')}`,
	// 		);
	// 	}

	// 	const transactions = await this.transactionsService.getTransactionList(validate.data, userId!);

	// 	return createApiResponse(
	// 		HttpStatus.OK,
	// 		'Transaction list fetched successfully',
	// 		transactions.data,
	// 		transactions.pagination,
	// 	);
	// }

	@UseGuards(JwtAuthGuard)
	@Post('')
	async createTransaction(
		@Body() validateTransactionDto: ValidateTransactionDto,
		@Req() req: Request,
	): Promise<ApiResponse<TransactionReturnType>> {
		const borrowerId = Number(req.user?.id);
		const lenderId = String(validateTransactionDto.lenderId);

		const getContact = await this.transactionsService.getOrCreateContactByPublicId(
			lenderId,
			borrowerId,
		);

		const extendedDto: ValidateTransactionDto = {
			...validateTransactionDto,
			borrowerId: getContact.requestedUserId,
			lenderId: getContact.connectedUserId,
			status: 'pending',
		};

		// Validate the incoming data
		const validate = validateTransactionSchema.safeParse(extendedDto);
		if (!validate.success) {
			throw new BadRequestException(
				`Validation failed: ${validate.error.issues.map(issue => issue.message).join(', ')}`,
			);
		}

		// Create the transaction
		const transaction = await this.transactionsService.createTransaction(validate.data);

		const responseTransaction: TransactionReturnType = {
			...transaction,
			id: transaction.publicId,
		};

		return createApiResponse(
			HttpStatus.CREATED,
			'Transaction created successfully',
			responseTransaction,
		);
	}

	@UseGuards(JwtAuthGuard)
	@Delete('')
	async deleteTransaction(
		@Body() body: ValidateDeleteTransactionDto,
	): Promise<ApiResponse<string | null>> {
		// Fetch the transaction by its public ID
		const transactions = await this.transactionsService.getTransactionsByPublicIds(
			body.transactionIds,
		);

		const { ineligibleTransactions, eligibleTransactions } =
			this.transactionsService.checkEligibilityForDeleting(transactions);

		const ineligibleTransactionsNumber = ineligibleTransactions.length;

		await this.transactionsService.deleteTransaction(eligibleTransactions.map(t => t));

		return createApiResponse(
			HttpStatus.OK,
			'Transaction deleted successfully',
			ineligibleTransactionsNumber > 0
				? `${ineligibleTransactionsNumber} transactions were not deleted as they are not eligible for deletion.`
				: null,
		);
	}

	@UseGuards(JwtAuthGuard)
	@Get('/requested')
	async getRequestedTransactionList(
		@Req() req: Request,
		@Query() query: TransactionQuerySchemaType,
	): Promise<ApiResponse<TransactionListReturnType[]>> {
		const userId = req.user?.id;

		const validate = transactionQuerySchema.safeParse(query);
		if (!validate.success) {
			throw new BadRequestException(
				`Validation failed: ${validate.error.issues.map(issue => issue.message).join(', ')}`,
			);
		}

		const transactions = await this.transactionsService.getRequestedTransactionList(
			validate.data,
			userId!,
		);

		return createApiResponse(
			HttpStatus.OK,
			'Transaction list fetched successfully',
			transactions.data,
			transactions.pagination,
		);
	}

	@UseGuards(JwtAuthGuard)
	@Put(':publicId/status')
	async updateTransactionStatus(
		@Param('publicId', ParseUUIDPipe) publicId: string,
		@Body() statusDto: ValidateUpdateTransactionDto['status'],
	): Promise<ApiResponse<TransactionReturnType>> {
		// Validate incoming status
		const validate = validateTransactionSchema.shape.status.safeParse(statusDto);
		if (!validate.success) {
			throw new BadRequestException(
				`Validation failed: ${validate.error.issues.map(issue => issue.message).join(', ')}`,
			);
		}

		// Fetch the transaction by its public ID
		const transaction = await this.transactionsService.getTransactionByPublicId(publicId);

		// Check eligibility for status update
		const eligibility = this.transactionsService.checkEligibilityForUpdatingStatus(
			transaction,
			validate.data,
		);

		if (!eligibility) {
			throw new BadRequestException(
				`Status update not allowed from ${transaction.status} to ${validate.data}`,
			);
		}

		// Update the transaction status
		const updatedTransaction = await this.transactionsService.updateTransactionStatus(
			transaction.id,
			validate.data,
		);

		const responseTransaction: TransactionReturnType = {
			...updatedTransaction,
			id: updatedTransaction.publicId,
		};

		return createApiResponse(
			HttpStatus.OK,
			'Transaction status updated successfully',
			responseTransaction,
		);
	}
}
