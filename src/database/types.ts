import type { InferSelectModel } from 'drizzle-orm';
import { accounts, sessions, users } from 'src/models/drizzle/auth.model';

export type UserSchemaType = InferSelectModel<typeof users>;
export type AccountSchemaType = InferSelectModel<typeof accounts>;
export type SessionSchemaType = InferSelectModel<typeof sessions>;

/**
 * Enum Schema Types
 */
