import {
	Inject,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../../database/connection';
import schema from '../../database/schema';
import DrizzleService from '../../database/service';
import { MediaDataType, MediaDeleteResponseType, MediaResponseType } from './@types/media.types';
import { MediaDto } from './media.schema';

@Injectable()
export class MediaService extends DrizzleService {
	constructor(
		@Inject(DATABASE_CONNECTION)
		db: NodePgDatabase<typeof schema>,
	) {
		super(db);
	}

	async uploadMedia(data: MediaDataType): Promise<boolean> {
		const createdMedia = await this.getDb()
			.insert(schema.media)
			.values(data)
			.returning()
			.then(res => res[0] || null);

		if (!createdMedia) throw new UnprocessableEntityException('Media could not be created');

		return !!createdMedia;
	}

	async getAllMedia(userId: number): Promise<MediaResponseType[]> {
		const mediaItems = await this.getDb()
			.select({
				publicId: schema.media.publicId,
				filename: schema.media.filename,
				mimeType: schema.media.mimeType,
				fileSize: schema.media.fileSize,
				secureUrl: schema.media.secureUrl,
				mediaType: schema.media.mediaType,
				altText: schema.media.altText,
				width: schema.media.width,
				height: schema.media.height,
				tags: schema.media.tags,
				createdAt: schema.media.createdAt,
				updatedAt: schema.media.updatedAt,
			})
			.from(schema.media)
			.where(eq(schema.media.uploadedBy, userId))
			.orderBy(schema.media.createdAt);

		return mediaItems;
	}

	async getMediaByPublicId(userId: number, publicId: string): Promise<MediaResponseType> {
		const mediaItem = await this.getDb()
			.select({
				publicId: schema.media.publicId,
				filename: schema.media.filename,
				mimeType: schema.media.mimeType,
				fileSize: schema.media.fileSize,
				secureUrl: schema.media.secureUrl,
				mediaType: schema.media.mediaType,
				altText: schema.media.altText,
				width: schema.media.width,
				height: schema.media.height,
				tags: schema.media.tags,
				createdAt: schema.media.createdAt,
				updatedAt: schema.media.updatedAt,
			})
			.from(schema.media)
			.where(and(eq(schema.media.publicId, publicId), eq(schema.media.uploadedBy, userId)))
			.then(res => res[0] || null);

		if (!mediaItem) throw new NotFoundException('Media not found');

		return mediaItem;
	}

	async updateMediaData(userId: number, publicId: string, data: MediaDto): Promise<boolean> {
		const updatedMedia = await this.getDb()
			.update(schema.media)
			.set({
				altText: data.altText,
				filename: data.name,
			})
			.where(and(eq(schema.media.publicId, publicId), eq(schema.media.uploadedBy, userId)))
			.returning()
			.then(res => res[0] || null);

		if (!updatedMedia) throw new UnprocessableEntityException('Media could not be updated');

		return !!updatedMedia;
	}

	async deleteMedia(userId: number, publicId: string): Promise<MediaDeleteResponseType> {
		const deletedMedia = await this.getDb()
			.delete(schema.media)
			.where(and(eq(schema.media.publicId, publicId), eq(schema.media.uploadedBy, userId)))
			.returning()
			.then(res => res[0] || null);

		if (!deletedMedia) throw new UnprocessableEntityException('Media could not be deleted');

		return deletedMedia;
	}

	async restrictMediaUpload(userId: number): Promise<boolean> {
		const mediaCount = await this.getDb()
			.select()
			.from(schema.media)
			.where(eq(schema.media.uploadedBy, userId))
			.then(res => res.length);

		// Example restriction: limit to 5 media items per user
		const MAX_MEDIA_PER_USER = 5;

		if (mediaCount >= MAX_MEDIA_PER_USER) {
			throw new UnprocessableEntityException(
				`Media upload limit reached. Maximum allowed is ${MAX_MEDIA_PER_USER} items.`,
			);
		}

		return mediaCount < MAX_MEDIA_PER_USER;
	}
}
