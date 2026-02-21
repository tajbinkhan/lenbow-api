import type { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

interface SameSiteCookieConfig {
	sameSite: CookieOptions['sameSite'];
	secure: boolean;
	domain?: string;
}

export default class AppHelpers {
	/**
	 * Determines if the input is an email or a username.
	 * @param input - The user-provided input.
	 * @returns "email" if the input is an email, "username" otherwise.
	 */
	static detectInputType(input: string): 'EMAIL' | 'USERNAME' {
		// Regular expression to validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(input) ? 'EMAIL' : 'USERNAME';
	}

	/**
	 * Generates a random OTP of the specified length.
	 * @param length - The length of the OTP to generate.
	 * @returns The generated OTP.
	 * @throws An error if the length is less than 4.
	 */
	static OTPGenerator(length: number = 4): number {
		if (length < 4) {
			throw new Error('The OTP length must be at least 4.');
		}

		const min = Math.pow(10, length - 1);
		const max = Math.pow(10, length) - 1;
		return Math.floor(Math.random() * (max - min + 1) + min);
	}

	/**
	 * Generate OTP expiry time.
	 * @param expiryTime - The expiry time in minutes.
	 * @returns The expiry time in Date format.
	 */
	static OTPExpiry(expiryTime: number = 5): Date {
		const now = new Date();
		return new Date(now.getTime() + expiryTime * 60000);
	}

	/**
	 * Determines the appropriate SameSite and secure settings for cookies based on environment variables.
	 * @param configService - NestJS ConfigService instance
	 * @returns The SameSite and secure settings for cookies.
	 */
	static sameSiteCookieConfig(configService: ConfigService<any, boolean>): SameSiteCookieConfig {
		const sameSite = configService.get<CookieOptions['sameSite']>('COOKIE_SAME_SITE', 'lax');
		const secure = configService.get<string>('COOKIE_SECURE') === 'true';
		const domain = configService.get<string>('COOKIE_DOMAIN');

		const config: SameSiteCookieConfig = {
			sameSite,
			secure,
		};

		if (domain) {
			config.domain = domain;
		}

		return config;
	}
}
