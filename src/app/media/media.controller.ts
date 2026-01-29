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
	Req,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { ApiResponse, createApiResponse } from '../../core/api-response.interceptor';
import { CloudinaryImageService } from '../../core/cloudinary/upload';
import { EnvType } from '../../core/env';
import { JwtAuthGuard } from '../auth/auth.guard';
import { MediaDataType, MediaResponseType } from './@types/media.types';
import { FILE_SIZE_LIMIT, singleFileSchema, ZodFileValidationPipe } from './media.pipe';
import { type MediaDto, mediaSchema } from './media.schema';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
	private readonly cloudinaryImageService: CloudinaryImageService;

	constructor(
		private readonly mediaService: MediaService,
		private configService: ConfigService<EnvType, true>,
	) {
		this.cloudinaryImageService = new CloudinaryImageService({
			cloudName: this.configService.get('CLOUDINARY_CLOUD_NAME'),
			apiKey: this.configService.get('CLOUDINARY_API_KEY'),
			apiSecret: this.configService.get('CLOUDINARY_API_SECRET'),
			folder: 'test-media-upload',
		});
	}

	@UseGuards(JwtAuthGuard)
	@Post('/')
	@UseInterceptors(
		FileInterceptor('file', {
			storage: memoryStorage(),
			// Multer-level hard limit (fast fail before Zod, still validate in Zod too)
			limits: { fileSize: FILE_SIZE_LIMIT },
		}),
	)
	async uploadMedia(
		@UploadedFile(new ZodFileValidationPipe(singleFileSchema))
		file: Express.Multer.File,
		@Req() request: Request,
	): Promise<ApiResponse<boolean>> {
		await this.mediaService.restrictMediaUpload(Number(request.user?.id));
		const result = await this.cloudinaryImageService.uploadFromBuffer(file.buffer);

		const data: MediaDataType = {
			altText: null,
			secureUrl: result.data!.secure_url,
			filename: file.originalname,
			mimeType: file.mimetype,
			fileExtension: file.originalname.split('.').pop() || '',
			fileSize: file.size,
			storageKey: result.data!.public_id,
			mediaType: file.mimetype.startsWith('image/') ? 'image' : 'other',
			storageMetadata: result.data!,
			uploadedBy: Number(request.user?.id),
			caption: null,
			description: null,
			tags: result.data!.tags || [],
			duration: result.data!.duration || null,
			width: result.data!.width || null,
			height: result.data!.height || null,
		};

		const response = await this.mediaService.uploadMedia(data);

		return createApiResponse(HttpStatus.OK, 'Media uploaded successfully', response);
	}

	@UseGuards(JwtAuthGuard)
	@Get('/')
	async getAllMedia(@Req() request: Request): Promise<ApiResponse<MediaResponseType[]>> {
		const mediaItems = await this.mediaService.getAllMedia(Number(request.user?.id));

		return createApiResponse(HttpStatus.OK, 'Media fetched successfully', mediaItems);
	}

	@UseGuards(JwtAuthGuard)
	@Put('/:id')
	async updateMedia(
		@Req() request: Request,
		@Body() body: MediaDto,
		@Param('id', ParseUUIDPipe) id: string,
	): Promise<ApiResponse<boolean>> {
		const userId = Number(request.user?.id);

		const validate = mediaSchema.safeParse(body);
		if (!validate.success) {
			throw new BadRequestException(validate.error.issues.map(issue => issue.message).join(', '));
		}

		const response = await this.mediaService.updateMediaData(userId, id, validate.data);

		return createApiResponse(HttpStatus.OK, 'Media updated successfully', response);
	}

	@UseGuards(JwtAuthGuard)
	@Delete('/:id')
	async deleteMedia(
		@Req() request: Request,
		@Param('id', ParseUUIDPipe) id: string,
	): Promise<ApiResponse<boolean>> {
		const userId = Number(request.user?.id);

		const response = await this.mediaService.deleteMedia(userId, id);

		await this.cloudinaryImageService.deleteMedia(response.storageKey);

		return createApiResponse(HttpStatus.OK, 'Media deleted successfully', true);
	}
}
