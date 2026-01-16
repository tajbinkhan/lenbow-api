import type { CookieOptions } from 'express';
import { blackListDomains } from './constants';

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
	 * Determines the appropriate SameSite and secure settings for cookies based on the provided URLs.
	 * @returns The SameSite and secure settings for cookies.
	 */
	static sameSiteCookieConfig(): SameSiteCookieConfig {
		try {
			// Helper function to check if hostname is an IP address
			const isIpAddress = (hostname: string): boolean => {
				return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
			};

			// Helper function to check if domain is blacklisted
			const isBlacklistedDomain = (domain: string): boolean => {
				return blackListDomains.some(blacklistedDomain =>
					domain.endsWith(blacklistedDomain.replace('.', '')),
				);
			};

			// Helper function to get domain from API_URL
			const getDomainFromApiUrl = (): string => {
				if (process.env.API_URL) {
					try {
						return new URL(process.env.API_URL).hostname;
					} catch {
						return process.env.API_URL;
					}
				}
				return 'localhost';
			};

			// Check if COOKIE_DOMAIN exists and determine environment
			const cookieDomain = process.env.COOKIE_DOMAIN;

			if (!cookieDomain) {
				// No COOKIE_DOMAIN set - assume local development
				const fullDomain = getDomainFromApiUrl();

				return {
					sameSite: 'lax',
					secure: false,
					domain: fullDomain,
				};
			}

			// Remove leading dot to check the actual domain
			const domainToCheck = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;

			// LOCAL DEVELOPMENT - detect by common local domains
			if (
				domainToCheck === 'localhost' ||
				domainToCheck === '127.0.0.1' ||
				isIpAddress(domainToCheck) ||
				cookieDomain === 'localhost'
			) {
				const fullDomain = getDomainFromApiUrl();

				return {
					sameSite: 'lax',
					secure: false,
					domain: fullDomain,
				};
			}

			// PRODUCTION ENVIRONMENT - any other domain
			// Check if domain is blacklisted
			if (isBlacklistedDomain(domainToCheck)) {
				// For blacklisted domains, use strict with full domain name
				const fullDomain = getDomainFromApiUrl();
				return {
					sameSite: 'none',
					secure: true,
					domain: fullDomain,
				};
			}

			// For non-blacklisted domains, use lax with configured domain
			return {
				sameSite: 'lax',
				secure: true,
				domain: cookieDomain,
			};
		} catch {
			// Error fallback - assume local development
			return {
				sameSite: 'lax',
				secure: false,
			};
		}
	}
}
