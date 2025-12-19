import {
	boolean,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
	'users',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		name: text('name'),
		email: text('email').notNull().unique(),
		password: text('password'),
		emailVerified: boolean('email_verified').default(false).notNull(),
		image: text('image'),
		is2faEnabled: boolean('is_2fa_enabled').default(false).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	table => ({
		publicIdIdx: uniqueIndex('users_public_id_idx').on(table.publicId),
		emailIdx: uniqueIndex('users_email_idx').on(table.email),
		emailVerifiedIdx: index('users_email_verified_idx').on(table.emailVerified),
		is2faEnabledIdx: index('users_is_2fa_enabled_idx').on(table.is2faEnabled),
	}),
);

export const sessions = pgTable(
	'sessions',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		token: text('token').notNull().unique(),
		ipAddress: text('ip_address').default('Unknown'),
		userAgent: text('user_agent').default('Unknown'),
		deviceName: varchar('device_name', { length: 255 }).default('Unknown Device'),
		deviceType: varchar('device_type', { length: 50 }).default('Unknown'),
		twoFactorVerified: boolean('two_factor_verified').default(false).notNull(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at').notNull(),
		isRevoked: boolean('is_revoked').default(false).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => new Date())
			.notNull(),
	},
	table => ({
		publicIdIdx: uniqueIndex('sessions_public_id_idx').on(table.publicId),
		tokenIdx: uniqueIndex('sessions_token_idx').on(table.token),
		userIdIdx: index('sessions_user_id_idx').on(table.userId),
		expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
		isRevokedIdx: index('sessions_is_revoked_idx').on(table.isRevoked),
		userIdIsRevokedIdx: index('sessions_user_id_is_revoked_idx').on(table.userId, table.isRevoked),
		userIdExpiresAtIdx: index('sessions_user_id_expires_at_idx').on(table.userId, table.expiresAt),
	}),
);

export const accounts = pgTable(
	'accounts',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => new Date())
			.notNull(),
	},
	table => ({
		publicIdIdx: uniqueIndex('accounts_public_id_idx').on(table.publicId),
		userIdIdx: index('accounts_user_id_idx').on(table.userId),
		accountIdProviderIdIdx: uniqueIndex('accounts_account_id_provider_id_idx').on(
			table.accountId,
			table.providerId,
		),
		providerIdIdx: index('accounts_provider_id_idx').on(table.providerId),
		accessTokenExpiresAtIdx: index('accounts_access_token_expires_at_idx').on(
			table.accessTokenExpiresAt,
		),
	}),
);

export const verifications = pgTable(
	'verifications',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	table => ({
		publicIdIdx: uniqueIndex('verifications_public_id_idx').on(table.publicId),
		identifierIdx: index('verifications_identifier_idx').on(table.identifier),
		valueIdx: index('verifications_value_idx').on(table.value),
		expiresAtIdx: index('verifications_expires_at_idx').on(table.expiresAt),
		identifierValueIdx: index('verifications_identifier_value_idx').on(
			table.identifier,
			table.value,
		),
	}),
);
