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
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createApiResponse, type ApiResponse } from '../../core/api-response.interceptor';
import { EnvType } from '../../core/env';
import { validateUUID } from '../../core/validators/commonRules';
import { TransactionHistoryActionEnum } from '../../database/types';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { BrevoService } from '../brevo/brevo.service';
import { ContactsService } from '../contacts/contacts.service';
import { CurrencyService } from '../currency/currency.service';
import { HistoryService } from '../history/history.service';
import type {
	TransactionListReturnType,
	TransactionReturnType,
	ValidateTransactionDtoWithCurrency,
	ValidateUpdateTransactionDtoWithCurrency,
} from './@types/transactions.types';
import {
	requestTransactionQuerySchema,
	transactionQuerySchema,
	validateTransactionSchema,
	validateUpdateStatusTransactionSchema,
	validateUpdateTransactionSchema,
	type RequestTransactionQuerySchemaType,
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
		private readonly authService: AuthService,
		private readonly transactionsService: TransactionsService,
		private readonly contactsService: ContactsService,
		private readonly historyService: HistoryService,
		private readonly brevoService: BrevoService,
		private readonly currencyService: CurrencyService,
		private configService: ConfigService<EnvType, true>,
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

		// Get currency details
		const currencyDetails = await this.currencyService.getCurrencyByCode(
			validateTransactionDto.currency,
		);

		const extendedDto: ValidateTransactionDto = {
			...validateTransactionDto,
			borrowerId,
			lenderId:
				borrowerId === getContact.connectedUserId
					? getContact.requestedUserId
					: getContact.connectedUserId,
			status: 'pending',
		};

		// Check if logged in user has default currency set, if not set it
		if (!req.user?.currencyCode) {
			await this.currencyService.addCurrencyToUser(borrowerId, currencyDetails.code);
		}

		// Validate the incoming data
		const validate = validateTransactionSchema.safeParse(extendedDto);
		if (!validate.success) {
			throw new BadRequestException(
				`Validation failed: ${validate.error.issues.map(issue => issue.message).join(', ')}`,
			);
		}

		const payload: Omit<ValidateTransactionDtoWithCurrency, 'type'> = {
			...validate.data,
			currency: {
				symbol: currencyDetails.symbol,
				name: currencyDetails.name,
				code: currencyDetails.code,
			},
		};

		// Create the transaction
		const transaction = await this.transactionsService.createTransaction(payload);

		const responseTransaction: TransactionReturnType = {
			...transaction,
			id: transaction.publicId,
		};

		await this.historyService.createTransactionHistoryRecord({
			transactionId: transaction.id,
			action: 'create',
			details: responseTransaction,
			occurredAt: new Date(),
		});

		// Fetch lender details to send email
		const lenderDetails = await this.authService.findUserById(transaction.lenderId);

		// Send email notification to lender
		if (lenderDetails) {
			await this.brevoService.sendFromTemplate({
				templateKey: 'request_send',
				to: [{ email: lenderDetails.email, name: lenderDetails.name || 'User' }],
				params: {
					borrowerName: req.user?.name || 'User',
					lenderName: lenderDetails.name || 'User',
					amount: transaction.amount,
					currencySymbol: transaction.currency.symbol,
					requestDate: new Date(transaction.requestDate).toLocaleDateString('en-US', {
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					}),
					dueDate: transaction.dueDate
						? new Date(transaction.dueDate).toLocaleDateString('en-US', {
								year: 'numeric',
								month: 'long',
								day: 'numeric',
							})
						: '',
					description: transaction.description || '',
					transactionId: transaction.publicId,
					actionUrl: `${this.configService.get('APP_URL')}/requests?search=${transaction.publicId}`,
					supportEmail: this.configService.get('BREVO_SENDER_EMAIL'),
					year: new Date().getFullYear(),
				},
			});
		}

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

		for (const transaction of transactions) {
			if (eligibleTransactions.includes(transaction.id)) {
				await this.historyService.createTransactionHistoryRecord({
					transactionId: null,
					action: 'delete',
					details: {
						...transaction,
						id: transaction.publicId,
					},
					occurredAt: new Date(),
				});
			}
		}

		return createApiResponse(
			HttpStatus.OK,
			'Transaction deleted successfully',
			ineligibleTransactionsNumber > 0
				? `${ineligibleTransactionsNumber} transactions were not deleted as they are not eligible for deletion.`
				: null,
		);
	}

	@UseGuards(JwtAuthGuard)
	@Get('requested')
	async getRequestedTransactionList(
		@Req() req: Request,
		@Query() query: RequestTransactionQuerySchemaType,
	): Promise<ApiResponse<TransactionListReturnType[]>> {
		const userId = req.user?.id;

		const validate = requestTransactionQuerySchema.safeParse(query);
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

		const currencyDetails = await this.currencyService.getCurrencyByCode(validate.data.currency);

		// Prepare update payload
		const payload: ValidateUpdateTransactionDtoWithCurrency = {
			...validate.data,
			currency: {
				symbol: currencyDetails.symbol,
				name: currencyDetails.name,
				code: currencyDetails.code,
			},
		};

		// Update the transaction status
		const updatedTransaction = await this.transactionsService.updateTransaction(
			transaction.id,
			payload,
		);

		const responseTransaction: TransactionReturnType = {
			...updatedTransaction,
			id: updatedTransaction.publicId,
		};

		await this.historyService.createTransactionHistoryRecord({
			transactionId: transaction.id,
			action: 'update',
			details: responseTransaction,
			occurredAt: new Date(),
		});

		if (
			transaction.amount !== updatedTransaction.amount ||
			transaction.currency.code !== updatedTransaction.currency.code ||
			transaction.dueDate?.toISOString() !== updatedTransaction.dueDate?.toISOString()
		) {
			// Send email notification to lender about the update
			const lender = await this.authService.findUserById(transaction.lenderId);

			await this.brevoService.sendFromTemplate({
				to: [{ email: lender.email, name: lender.name || 'User' }],
				templateKey: 'transaction_updated',
				params: {
					borrowerName: user.name,
					lenderName: lender.name,
					amount: updatedTransaction.amount.toFixed(2),
					currencySymbol: updatedTransaction.currency.symbol,
					currencyName: updatedTransaction.currency.name,
					dueDate: updatedTransaction.dueDate
						? new Date(updatedTransaction.dueDate).toLocaleDateString('en-US', {
								year: 'numeric',
								month: 'long',
								day: 'numeric',
							})
						: undefined,
					transactionId: updatedTransaction.publicId,
					actionUrl: `${this.configService.get('APP_URL')}/requests?search=${updatedTransaction.publicId}`,
					supportEmail: this.configService.get('BREVO_SENDER_EMAIL'),
					year: new Date().getFullYear().toString(),
				},
			});
		}

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

		let historyAction: TransactionHistoryActionEnum = 'status_change';

		switch (validate.data.status) {
			case 'requested_repay':
				historyAction = 'request_repay';
				break;
			case 'partially_paid':
				historyAction = 'partial_repay';
				break;
			case 'completed':
				historyAction = 'complete_repay';
				break;
			case 'accepted':
				historyAction = 'accept_repay';
				break;
			case 'rejected':
				historyAction = 'reject_repay';
				break;
		}

		await this.historyService.createTransactionHistoryRecord({
			transactionId: transaction.id,
			action: historyAction,
			details: responseTransaction,
			occurredAt: new Date(),
		});

		// Send email notifications based on status change
		const borrowerDetails = await this.authService.findUserById(transaction.borrowerId);
		const lenderDetails = await this.authService.findUserById(transaction.lenderId);

		if (validate.data.status === 'accepted' && borrowerDetails) {
			// Notify borrower that their request was approved
			await this.brevoService.sendFromTemplate({
				templateKey: 'request_approved',
				to: [{ email: borrowerDetails.email, name: borrowerDetails.name || 'User' }],
				params: {
					borrowerName: borrowerDetails.name || 'User',
					lenderName: lenderDetails?.name || 'Lender',
					amount: updatedTransaction.amount,
					currencySymbol: updatedTransaction.currency.symbol,
					acceptedAt: new Date(updatedTransaction.acceptedAt || new Date()).toLocaleDateString(
						'en-US',
						{
							year: 'numeric',
							month: 'long',
							day: 'numeric',
						},
					),
					requestDate: new Date(updatedTransaction.requestDate).toLocaleDateString('en-US', {
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					}),
					dueDate: updatedTransaction.dueDate
						? new Date(updatedTransaction.dueDate).toLocaleDateString('en-US', {
								year: 'numeric',
								month: 'long',
								day: 'numeric',
							})
						: '',
					transactionId: updatedTransaction.publicId,
					actionUrl: `${this.configService.get('APP_URL')}/borrow?search=${updatedTransaction.publicId}`,
					supportEmail: this.configService.get('BREVO_SENDER_EMAIL'),
					year: new Date().getFullYear(),
				},
			});
		} else if (validate.data.status === 'rejected' && borrowerDetails) {
			// Notify borrower that their request was rejected
			await this.brevoService.sendFromTemplate({
				templateKey: 'request_rejected',
				to: [{ email: borrowerDetails.email, name: borrowerDetails.name || 'User' }],
				params: {
					borrowerName: borrowerDetails.name || 'User',
					lenderName: lenderDetails?.name || 'Lender',
					amount: updatedTransaction.amount,
					currencySymbol: updatedTransaction.currency.symbol,
					rejectedAt: new Date(updatedTransaction.rejectedAt || new Date()).toLocaleDateString(
						'en-US',
						{
							year: 'numeric',
							month: 'long',
							day: 'numeric',
						},
					),
					rejectionReason: updatedTransaction.rejectionReason || '',
					transactionId: updatedTransaction.publicId,
					actionUrl: `${this.configService.get('APP_URL')}/history?search=${updatedTransaction.publicId}`,
					supportEmail: this.configService.get('BREVO_SENDER_EMAIL'),
					year: new Date().getFullYear(),
				},
			});
		} else if (validate.data.status === 'requested_repay' && lenderDetails) {
			// Notify lender that borrower wants to make a repayment
			await this.brevoService.sendFromTemplate({
				templateKey: 'repayment_requested',
				to: [{ email: lenderDetails.email, name: lenderDetails.name || 'User' }],
				params: {
					lenderName: lenderDetails.name || 'User',
					borrowerName: borrowerDetails?.name || 'Borrower',
					reviewAmount: updatedTransaction.reviewAmount,
					amount: updatedTransaction.amount,
					amountPaid: updatedTransaction.amountPaid,
					remainingAmount: updatedTransaction.remainingAmount,
					currencySymbol: updatedTransaction.currency.symbol,
					transactionId: updatedTransaction.publicId,
					actionUrl: `${this.configService.get('APP_URL')}/lend?search=${updatedTransaction.publicId}`,
					supportEmail: this.configService.get('BREVO_SENDER_EMAIL'),
					year: new Date().getFullYear(),
				},
			});
		} else if (validate.data.status === 'completed' && borrowerDetails && lenderDetails) {
			// Notify both borrower and lender that loan is completed
			const completedParams = {
				amount: updatedTransaction.amount,
				currencySymbol: updatedTransaction.currency.symbol,
				completedAt: new Date(updatedTransaction.completedAt || new Date()).toLocaleDateString(
					'en-US',
					{
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					},
				),
				reviewAmount: updatedTransaction.reviewAmount,
				requestDate: new Date(updatedTransaction.requestDate).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				}),
				transactionId: updatedTransaction.publicId,
				actionUrl: `${this.configService.get('APP_URL')}/lend?search=${updatedTransaction.publicId}`,
				supportEmail: this.configService.get('BREVO_SENDER_EMAIL'),
				year: new Date().getFullYear(),
			};

			// Send to borrower
			await this.brevoService.sendFromTemplate({
				templateKey: 'repayment_completed',
				to: [{ email: borrowerDetails.email, name: borrowerDetails.name || 'User' }],
				params: {
					...completedParams,
					borrowerName: borrowerDetails.name || 'User',
					lenderName: lenderDetails.name || 'Lender',
				},
			});

			// Send to lender
			await this.brevoService.sendFromTemplate({
				templateKey: 'repayment_completed_lender',
				to: [{ email: lenderDetails.email, name: lenderDetails.name || 'User' }],
				params: {
					...completedParams,
					borrowerName: borrowerDetails.name || 'Borrower',
					lenderName: lenderDetails.name || 'User',
				},
			});
		}

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

		await this.historyService.createTransactionHistoryRecord({
			transactionId: transaction.id,
			action: 'accept_repay',
			details: responseTransaction,
			occurredAt: new Date(),
		});

		// Send email notification to borrower
		const borrowerDetails = await this.authService.findUserById(transaction.borrowerId);
		const lenderDetails = await this.authService.findUserById(transaction.lenderId);

		if (borrowerDetails) {
			// Check if loan is completed
			if (status === 'completed') {
				// Send completion email
				const completedParams = {
					amount: updatedTransaction.amount,
					currencySymbol: updatedTransaction.currency.symbol,
					completedAt: new Date(updatedTransaction.completedAt || new Date()).toLocaleDateString(
						'en-US',
						{
							year: 'numeric',
							month: 'long',
							day: 'numeric',
						},
					),
					reviewAmount: transaction.reviewAmount,
					requestDate: new Date(updatedTransaction.requestDate).toLocaleDateString('en-US', {
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					}),
					transactionId: updatedTransaction.publicId,
					actionUrl: `${this.configService.get('APP_URL')}/transactions/${updatedTransaction.publicId}`,
					supportEmail: this.configService.get('BREVO_SENDER_EMAIL'),
					year: new Date().getFullYear(),
				};

				// Send to borrower
				await this.brevoService.sendFromTemplate({
					templateKey: 'repayment_completed',
					to: [{ email: borrowerDetails.email, name: borrowerDetails.name || 'User' }],
					params: {
						...completedParams,
						borrowerName: borrowerDetails.name || 'User',
						lenderName: lenderDetails?.name || 'Lender',
					},
				});

				// Send to lender
				if (lenderDetails) {
					await this.brevoService.sendFromTemplate({
						templateKey: 'repayment_completed_lender',
						to: [{ email: lenderDetails.email, name: lenderDetails.name || 'User' }],
						params: {
							...completedParams,
							borrowerName: borrowerDetails.name || 'Borrower',
							lenderName: lenderDetails.name || 'User',
						},
					});
				}
			} else {
				// Send repayment accepted email
				await this.brevoService.sendFromTemplate({
					templateKey: 'repayment_accepted',
					to: [{ email: borrowerDetails.email, name: borrowerDetails.name || 'User' }],
					params: {
						borrowerName: borrowerDetails.name || 'User',
						lenderName: lenderDetails?.name || 'Lender',
						amount: updatedTransaction.amount,
						reviewAmount: transaction.reviewAmount,
						amountPaid: updatedTransaction.amountPaid,
						remainingAmount: updatedTransaction.remainingAmount,
						currencySymbol: updatedTransaction.currency.symbol,
						transactionId: updatedTransaction.publicId,
						actionUrl: `${this.configService.get('APP_URL')}/borrow/${updatedTransaction.publicId}`,
						supportEmail: this.configService.get('BREVO_SENDER_EMAIL'),
						year: new Date().getFullYear(),
					},
				});
			}
		}

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

		await this.historyService.createTransactionHistoryRecord({
			transactionId: transaction.id,
			action: 'reject_repay',
			details: responseTransaction,
			occurredAt: new Date(),
		});

		// Send email notification to borrower
		const borrowerDetails = await this.authService.findUserById(transaction.borrowerId);
		const lenderDetails = await this.authService.findUserById(transaction.lenderId);

		if (borrowerDetails) {
			await this.brevoService.sendFromTemplate({
				templateKey: 'repayment_rejected',
				to: [{ email: borrowerDetails.email, name: borrowerDetails.name || 'User' }],
				params: {
					borrowerName: borrowerDetails.name || 'User',
					lenderName: lenderDetails?.name || 'Lender',
					reviewAmount: transaction.reviewAmount,
					amount: updatedTransaction.amount,
					amountPaid: updatedTransaction.amountPaid,
					remainingAmount: updatedTransaction.remainingAmount,
					currencySymbol: updatedTransaction.currency.symbol,
					transactionId: updatedTransaction.publicId,
					actionUrl: `${this.configService.get('APP_URL')}/transactions/${updatedTransaction.publicId}`,
					supportEmail: this.configService.get('BREVO_SENDER_EMAIL'),
					year: new Date().getFullYear(),
				},
			});
		}

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
