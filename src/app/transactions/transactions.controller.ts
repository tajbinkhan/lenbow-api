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
import { createApiResponse, type ApiResponse } from '../../core/api-response.interceptor';
import { validateUUID } from '../../core/validators/commonRules';
import { JwtAuthGuard } from '../auth/auth.guard';
import { ContactsService } from '../contacts/contacts.service';
import type { TransactionListReturnType, TransactionReturnType } from './@types/transactions.types';
import {
	transactionQuerySchema,
	validateTransactionSchema,
	validateUpdateStatusTransactionSchema,
	validateUpdateTransactionSchema,
	type TransactionQuerySchemaType,
	type ValidateDeleteTransactionDto,
	type ValidateTransactionDto,
	type ValidateUpdateStatusTransactionDto,
	type ValidateUpdateTransactionDto,
} from './transactions.schema';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
	constructor(
		private readonly transactionsService: TransactionsService,
		private readonly contactsService: ContactsService,
	) {}

	@UseGuards(JwtAuthGuard)
	@Get('')
	async getTransactionList(
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

		const transactions = await this.transactionsService.getTransactionList(validate.data, userId!);

		return createApiResponse(
			HttpStatus.OK,
			'Transaction list fetched successfully',
			transactions.data,
			transactions.pagination,
		);
	}

	@UseGuards(JwtAuthGuard)
	@Post('')
	async createTransaction(
		@Body() validateTransactionDto: ValidateTransactionDto,
		@Req() req: Request,
	): Promise<ApiResponse<TransactionReturnType>> {
		const borrowerId = Number(req.user?.id);
		const lenderId = String(validateTransactionDto.lenderId);

		const checkUUID = validateUUID('Lender ID').safeParse(lenderId);
		if (!checkUUID.success) {
			throw new BadRequestException(`Validation failed: ${checkUUID.error.issues[0].message}`);
		}

		const getContact = await this.contactsService.getOrCreateContactByPublicId(
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
		@Req() req: Request,
	): Promise<ApiResponse<string | null>> {
		const user = req.user;

		// Fetch the transaction by its public ID
		const transactions = await this.transactionsService.getTransactionsByPublicIds(
			body.transactionIds,
			user!.id,
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
	@Put(':publicId/update')
	async updateTransaction(
		@Param('publicId', ParseUUIDPipe) publicId: string,
		@Req() req: Request,
		@Body() body: ValidateUpdateTransactionDto,
	): Promise<ApiResponse<TransactionReturnType>> {
		const user = req.user;

		// Validate incoming status
		const validate = validateUpdateTransactionSchema.safeParse(body);
		if (!validate.success) {
			throw new BadRequestException(
				`Validation failed: ${validate.error.issues.map(issue => issue.message).join(', ')}`,
			);
		}

		// Fetch the transaction by its public ID
		const transaction = await this.transactionsService.getTransactionByPublicId(publicId);

		if (transaction.borrowerId !== user?.id)
			throw new BadRequestException(`Only borrower can update the transaction details.`);

		if (transaction.status !== 'pending')
			throw new BadRequestException(`Only pending transactions can be updated.`);

		// Update the transaction status
		const updatedTransaction = await this.transactionsService.updateTransaction(
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

	@UseGuards(JwtAuthGuard)
	@Put(':publicId/status')
	async updateTransactionStatus(
		@Param('publicId', ParseUUIDPipe) publicId: string,
		@Body() statusDto: ValidateUpdateStatusTransactionDto,
		@Req() req: Request,
	): Promise<ApiResponse<TransactionReturnType>> {
		const user = req.user;

		// Validate incoming status
		const validate = validateUpdateStatusTransactionSchema.safeParse(statusDto);
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
			validate.data.status,
		);

		if (!eligibility) {
			throw new BadRequestException(
				`Status update not allowed from ${transaction.status} to ${validate.data.status}`,
			);
		}

		if (
			(validate.data.status === 'accepted' ||
				validate.data.status === 'rejected' ||
				validate.data.status === 'partially_paid' ||
				validate.data.status === 'completed') &&
			transaction.lenderId !== user?.id
		)
			throw new BadRequestException(`Only lender can update the transaction status.`);

		if (validate.data.status === 'requested_repay' && transaction.borrowerId !== user?.id) {
			const eligibility = this.transactionsService.checkEligibilityForReviewAmount(
				transaction,
				validate.data.reviewAmount,
			);

			if (!eligibility.eligible && eligibility.reason) {
				throw new BadRequestException(
					`Transaction not eligible for requesting repay: ${eligibility.reason}`,
				);
			}
			throw new BadRequestException(`Only borrower can request repay for the transaction.`);
		}

		// Update the transaction status
		const updatedTransaction = await this.transactionsService.updateTransactionStatus(
			transaction.id,
			validate.data.status,
			{
				rejectionReason:
					validate.data.status === 'rejected' && 'rejectionReason' in statusDto
						? statusDto.rejectionReason
						: undefined,
				reviewAmount: this.transactionsService.calculateReviewAmount(
					validate.data.status,
					'reviewAmount' in validate.data ? validate.data.reviewAmount : 0,
				),
				amountPaid: this.transactionsService.calculateAmountPaid(
					transaction.amountPaid,
					transaction.reviewAmount,
					validate.data.status,
				),
				remainingAmount: this.transactionsService.calculateRemainingAmount(
					transaction.remainingAmount,
					transaction.reviewAmount,
					validate.data.status,
				),
			},
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

	@UseGuards(JwtAuthGuard)
	@Put(':publicId/repayment/accept')
	async acceptTransaction(
		@Param('publicId', ParseUUIDPipe) publicId: string,
		@Req() req: Request,
	): Promise<ApiResponse<TransactionReturnType>> {
		const user = req.user;

		// Fetch the transaction by its public ID
		const transaction = await this.transactionsService.getTransactionByPublicId(publicId);

		if (transaction.lenderId !== user?.id)
			throw new BadRequestException(`Only lender can accept the transaction.`);

		if (transaction.status !== 'requested_repay')
			throw new BadRequestException(`Only requested repay transactions can be accepted.`);

		const status = this.transactionsService.defineTransactionStatusAfterAccepting(
			transaction.reviewAmount,
			transaction.remainingAmount,
		);

		// Update the transaction status to accepted
		const updatedTransaction = await this.transactionsService.updateTransactionStatus(
			transaction.id,
			status,
			{
				amountPaid: this.transactionsService.calculateAmountPaid(
					transaction.amountPaid,
					transaction.reviewAmount,
					status,
				),
				remainingAmount: this.transactionsService.calculateRemainingAmount(
					transaction.remainingAmount,
					transaction.reviewAmount,
					status,
				),
				reviewAmount: 0,
			},
		);

		const responseTransaction: TransactionReturnType = {
			...updatedTransaction,
			id: updatedTransaction.publicId,
		};

		return createApiResponse(
			HttpStatus.OK,
			'Transaction accepted successfully',
			responseTransaction,
		);
	}

	@UseGuards(JwtAuthGuard)
	@Put(':publicId/repayment/reject')
	async rejectTransaction(
		@Param('publicId', ParseUUIDPipe) publicId: string,
		@Req() req: Request,
	): Promise<ApiResponse<TransactionReturnType>> {
		const user = req.user;

		// Fetch the transaction by its public ID
		const transaction = await this.transactionsService.getTransactionByPublicId(publicId);

		if (transaction.lenderId !== user?.id)
			throw new BadRequestException(`Only lender can reject the transaction.`);

		if (transaction.status !== 'requested_repay')
			throw new BadRequestException(`Only requested repay transactions can be rejected.`);

		const status =
			transaction.remainingAmount === transaction.amount ? 'accepted' : 'partially_paid';

		// Update the transaction status to rejected
		const updatedTransaction = await this.transactionsService.updateTransactionStatus(
			transaction.id,
			status,
			{
				reviewAmount: 0,
			},
		);

		const responseTransaction: TransactionReturnType = {
			...updatedTransaction,
			id: updatedTransaction.publicId,
		};

		return createApiResponse(
			HttpStatus.OK,
			'Transaction rejected successfully',
			responseTransaction,
		);
	}

	@UseGuards(JwtAuthGuard)
	@Get(':publicId')
	async getTransaction(
		@Param('publicId', ParseUUIDPipe) publicId: string,
		@Req() req: Request,
	): Promise<ApiResponse<TransactionReturnType>> {
		const user = req.user;
		// Fetch the transaction by its public ID
		const transaction = await this.transactionsService.getTransactionByPublicId(publicId);

		if (transaction.borrowerId !== user?.id && transaction.lenderId !== user?.id)
			throw new BadRequestException(`You are not authorized to view this transaction.`);

		const responseTransaction: TransactionReturnType = {
			...transaction,
			id: transaction.publicId,
		};

		return createApiResponse(
			HttpStatus.OK,
			'Transaction status updated successfully',
			responseTransaction,
		);
	}
}
