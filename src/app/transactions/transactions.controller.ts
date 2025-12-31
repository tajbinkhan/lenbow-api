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
import { AuthService } from '../auth/auth.service';
import type {
	ConnectedContactList,
	TransactionListReturnType,
	TransactionReturnType,
} from './@types/transactions.types';
import {
	transactionQuerySchema,
	validateTransactionSchema,
	validateUpdateTransactionSchema,
	type TransactionQuerySchemaType,
	type ValidateDeleteTransactionDto,
	type ValidateTransactionDto,
	type ValidateUpdateTransactionDto,
} from './transactions.schema';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
	constructor(
		private readonly transactionsService: TransactionsService,
		private readonly authService: AuthService,
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

		const getContact = await this.transactionsService.getOrCreateContactByPublicId(
			lenderId,
			borrowerId,
		);

		let typeBorrowerId: number;
		let typeLenderId: number;

		if (validateTransactionDto.type === 'lend') {
			typeBorrowerId = getContact.connectedUserId;
			typeLenderId = getContact.requestedUserId;
		} else {
			// 'borrow'
			typeBorrowerId = getContact.requestedUserId;
			typeLenderId = getContact.connectedUserId;
		}

		const extendedDto: ValidateTransactionDto = {
			...validateTransactionDto,
			borrowerId: typeBorrowerId,
			lenderId: typeLenderId,
			status: 'pending',
		};

		// Validate the incoming data
		const validate = validateTransactionSchema.safeParse(extendedDto);
		if (!validate.success) {
			throw new BadRequestException(
				`Validation failed: ${validate.error.issues.map(issue => issue.message).join(', ')}`,
			);
		}

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { type, ...rest } = validate.data;

		// Create the transaction
		const transaction = await this.transactionsService.createTransaction(rest);

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
	@Get('/connected-contacts')
	async getConnectedContactList(@Req() req: Request): Promise<ApiResponse<ConnectedContactList[]>> {
		const currentUserId = req.user?.id;

		const contacts = await this.transactionsService.getConnectedContacts(currentUserId!);

		return createApiResponse(HttpStatus.OK, 'Connected contacts fetched successfully', contacts);
	}

	@UseGuards(JwtAuthGuard)
	@Get('/contact/:publicId')
	async getContactByPublicId(
		@Param('publicId', ParseUUIDPipe) publicId: string,
	): Promise<ApiResponse<ConnectedContactList>> {
		const user = await this.authService.findUserByPublicId(publicId);

		const contact: ConnectedContactList = {
			userId: user.publicId,
			name: user.name,
			email: user.email,
			image: user.image,
			phone: user.phone,
			connectedAt: user.createdAt,
		};

		return createApiResponse(HttpStatus.OK, 'Contact fetched successfully', contact);
	}

	@UseGuards(JwtAuthGuard)
	@Put(':publicId/update-pending')
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
		@Body() statusDto: ValidateTransactionDto['status'],
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

	@UseGuards(JwtAuthGuard)
	@Put(':publicId')
	async getTransaction(
		@Param('publicId', ParseUUIDPipe) publicId: string,
		@Req() req: Request,
	): Promise<ApiResponse<TransactionReturnType>> {
		const user = req.user;
		// Fetch the transaction by its public ID
		const transaction = await this.transactionsService.getTransactionByPublicId(publicId);

		if (transaction.borrowerId !== user?.id || transaction.lenderId !== user?.id)
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
