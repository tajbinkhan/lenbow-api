import {
	BadRequestException,
	Controller,
	Get,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Query,
	Req,
	UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { createApiResponse, type ApiResponse } from '../../core/api-response.interceptor';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import type { ConnectedContactList, ContactListReturnType } from './@types/contacts.types';
import { contactQuerySchema, type ContactQuerySchemaType } from './contacts.schema';
import { ContactsService } from './contacts.service';

@Controller('contacts')
export class ContactsController {
	constructor(
		private readonly contactsService: ContactsService,
		private readonly authService: AuthService,
	) {}

	@UseGuards(JwtAuthGuard)
	@Get('')
	async getContactList(
		@Req() req: Request,
		@Query() query: ContactQuerySchemaType,
	): Promise<ApiResponse<ContactListReturnType[]>> {
		const userId = req.user?.id;

		const validate = contactQuerySchema.safeParse(query);
		if (!validate.success) {
			throw new BadRequestException(
				`Validation failed: ${validate.error.issues.map(issue => issue.message).join(', ')}`,
			);
		}

		const contacts = await this.contactsService.getConnectedContactList(validate.data, userId!);

		return createApiResponse(
			HttpStatus.OK,
			'Contact list fetched successfully',
			contacts.data,
			contacts.pagination,
		);
	}

	@UseGuards(JwtAuthGuard)
	@Get('connected')
	async getConnectedContactList(@Req() req: Request): Promise<ApiResponse<ConnectedContactList[]>> {
		const currentUserId = req.user?.id;

		const contacts = await this.contactsService.getConnectedContacts(currentUserId!);

		return createApiResponse(HttpStatus.OK, 'Connected contacts fetched successfully', contacts);
	}

	@UseGuards(JwtAuthGuard)
	@Get(':publicId')
	async getContactByPublicId(
		@Param('publicId', ParseUUIDPipe) publicId: string,
		@Req() req: Request,
	): Promise<ApiResponse<ConnectedContactList>> {
		const currentUserId = req.user?.publicId;
		const user = await this.authService.findUserByPublicId(publicId);

		if (user.publicId === currentUserId)
			throw new BadRequestException('You cannot connect to yourself');

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
}
