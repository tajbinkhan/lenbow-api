import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { CryptoService } from '../../../core/crypto/crypto.service';
import type { EnvType } from '../../../core/env';
import { AuthService } from '../auth.service';
import { AuthSession } from '../auth.session';

interface JwtPayload {
	sub: number;
	email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		private readonly configService: ConfigService<EnvType, true>,
		private readonly authService: AuthService,
		private readonly authSession: AuthSession,
		private readonly cryptoService: CryptoService,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(request: Request) => {
					return request?.cookies?.['access-token'] as string | null;
				},
			]),
			ignoreExpiration: false,
			secretOrKey: configService.get('SECRET', { infer: true }),
			passReqToCallback: true,
		});
	}

	async validate(request: Request, payload: JwtPayload): Promise<Express.User> {
		// Access the JWT token from the request
		const jwtToken = request.cookies?.['access-token'] as string;

		if (!jwtToken) throw new UnauthorizedException('Unauthorized');

		// Decrypt the user ID
		const decryptedUserId = this.cryptoService.decrypt(payload.sub.toString());
		payload.sub = parseInt(decryptedUserId, 10);

		// Fetch full user from database using AuthService
		const user = await this.authService.findUserById(payload.sub);

		if (!user.emailVerified) throw new UnauthorizedException('Email not verified');

		// Check if the user session is valid
		const session = await this.authSession.validateSession(user.id, jwtToken);

		// If user has 2FA enabled, verify the session has completed 2FA
		if (user.is2faEnabled && !session.twoFactorVerified) {
			throw new UnauthorizedException({
				message: 'Please complete 2FA verification to access this resource.',
				code: 'TWO_FACTOR_REQUIRED',
			});
		}

		return user;
	}
}
