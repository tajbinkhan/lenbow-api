import {
	bigint,
	decimal,
	integer,
	json,
	pgTable,
	serial,
	text,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';
import { timestamps } from '../../database/helpers';
import { users } from './auth.model';

export const media = pgTable('media', {
	id: serial('id').primaryKey(),
	publicId: uuid('public_id').defaultRandom().notNull().unique(),

	// File identification
	filename: varchar('filename', { length: 255 }).notNull(),
	mimeType: varchar('mime_type', { length: 100 }).notNull(),
	fileExtension: varchar('file_extension', { length: 10 }).notNull(),
	secureUrl: text('secure_url'), // HTTPS URL (optional for some providers)

	// File properties
	fileSize: bigint('file_size', { mode: 'number' }).notNull(), // in bytes
	width: integer('width'),
	height: integer('height'),
	duration: decimal('duration', { precision: 10, scale: 2 }), // for videos/audio in seconds

	// Unique storage information
	storageKey: text('storage_key').notNull(),

	// File type categorization
	mediaType: text('media_type').notNull(),

	// Organization
	altText: text('alt_text'),
	caption: text('caption'),
	description: text('description'),
	tags: json('tags'), // Array of tags for better organization

	// Storage specific metadata
	storageMetadata: json('storage_metadata'), // Provider-specific data (transformations, ACL, etc.)

	// Author information
	uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),

	// Timestamps
	...timestamps,
});
