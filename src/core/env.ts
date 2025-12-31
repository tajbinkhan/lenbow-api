import { z } from 'zod';

import { validateEnum, validateString } from './validators/commonRules';

// const smtpEnvSchema = z.object({
// 	SMTP_HOST: validateString('SMTP_HOST'),
// 	SMTP_PORT: validateEnvNumber('SMTP_PORT', { min: 1, max: 65535, int: true }),
// 	SMTP_USER: validateString('SMTP_USER'),
// 	SMTP_PASSWORD: validateString('SMTP_PASSWORD'),
// });

const googleEnvSchema = z.object({
	GOOGLE_CLIENT_ID: validateString('GOOGLE_CLIENT_ID'),
	GOOGLE_CLIENT_SECRET: validateString('GOOGLE_CLIENT_SECRET'),
	GOOGLE_CALLBACK_URL: validateString('GOOGLE_CALLBACK_URL'),
});

export const envSchema = z.object({
	DATABASE_URL: validateString('DATABASE_URL'),
	PORT: validateString('PORT').refine(value => !isNaN(Number(value)), 'PORT must be a number'),
	SECRET: validateString('SECRET'),
	NODE_ENV: validateEnum('NODE_ENV', ['development', 'production']).default('development'),
	COOKIE_DOMAIN: validateString('COOKIE_DOMAIN'),
	ORIGIN_URL: validateString('ORIGIN_URL'),
	API_URL: validateString('API_URL'),
	...googleEnvSchema.shape,
	// ...smtpEnvSchema.shape,
});

export type EnvType = z.infer<typeof envSchema>;

// NestJS ConfigModule validation function
export function validateEnv(config: Record<string, unknown>): EnvType {
	const result = envSchema.safeParse(config);

	if (!result.success) {
		const errorMessages = result.error.issues.map(e => e.message).join('\n');
		console.error(`\x1b[31mEnvironment validation failed:\n${errorMessages}\x1b[0m`);
		throw new Error('Environment validation failed');
	}

	return result.data;
}
