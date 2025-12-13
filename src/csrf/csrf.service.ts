import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { doubleCsrf } from 'csrf-csrf';
import type { Request, Response } from 'express';
import { EnvType } from 'src/core/env';

@Injectable()
export class CsrfService {
	private readonly generateToken: ReturnType<typeof doubleCsrf>['generateCsrfToken'];
	private readonly validate: ReturnType<typeof doubleCsrf>['validateRequest'];
	private readonly protection: ReturnType<typeof doubleCsrf>['doubleCsrfProtection'];

	constructor(private readonly configService: ConfigService<EnvType, true>) {
		const secret = this.configService.get('SECRET', { infer: true });

		const { generateCsrfToken, validateRequest, doubleCsrfProtection } = doubleCsrf({
			getSecret: () => secret,
			getSessionIdentifier: () => secret,
			cookieName: 'csrf-token',
			// cookieOptions: {
			// 	maxAge: csrfTimeout,
			// 	sameSite: 'lax',
			// 	secure: process.env.NODE_ENV === 'production',
			// 	httpOnly: true,
			// 	...(this.configService.get('COOKIE_DOMAIN') && {
			// 		domain: this.configService.get('COOKIE_DOMAIN')
			// 	})
			// },
			size: 32,
			errorConfig: {
				message:
					'Invalid CSRF token. Perhaps your browser blocked 3rd-party cookies. Please allow 3rd-party cookies or try a different browser. If the problem persists, please contact support.',
				statusCode: 403,
			},
			getCsrfTokenFromRequest: (req: Request) => req.headers['x-csrf-token'] as string,
		});

		this.generateToken = generateCsrfToken;
		this.validate = validateRequest;
		this.protection = doubleCsrfProtection;
	}

	/**
	 * Generate a new CSRF token for the given request
	 */
	generateCsrfToken(req: Request, res: Response): string {
		return this.generateToken(req, res);
	}

	/**
	 * Validate CSRF token from request
	 */
	validateRequest(req: Request): boolean {
		return this.validate(req);
	}

	/**
	 * Get CSRF protection middleware
	 */
	getProtection() {
		return this.protection;
	}
}
