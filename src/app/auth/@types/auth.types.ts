import { SessionSchemaType, UserSchemaType } from 'src/database/types';

export type UserWithoutPassword = Omit<UserSchemaType, 'password'>;

export type CreateUser = Omit<UserSchemaType, 'id' | 'is2faEnabled' | 'createdAt' | 'updatedAt'>;

export type SessionDataType = Omit<
	SessionSchemaType,
	'id' | 'twoFactorVerified' | 'isRevoked' | 'createdAt' | 'updatedAt'
>;
