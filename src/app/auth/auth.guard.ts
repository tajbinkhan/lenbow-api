import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
	getAuthenticateOptions(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<Request>();
		const redirect = request.query.redirect as string | undefined;

		// Pass redirect URL as state parameter through OAuth flow
		if (redirect) {
			return { state: Buffer.from(JSON.stringify({ redirect })).toString('base64') };
		}

		return {};
	}

	handleRequest<TUser = unknown>(
		err: Error | null,
		user: TUser | false,
		info: Error | undefined,
		context: ExecutionContext,
	): TUser {
		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();

		// Handle OAuth errors with descriptive messages
		if (err) {
			const errorMessage = this.getOAuthErrorMessage(err);
			throw new UnauthorizedException(errorMessage);
		}

		if (!user || err) {
			const redirectUrl = this.getRedirectFromState(request);

			if (redirectUrl) {
				response.redirect(`${redirectUrl}?error=access_denied`);
				return {} as TUser;
			}

			throw new UnauthorizedException(
				info?.message || 'Google authentication failed. Please try again.',
			);
		}

		return user;
	}

	private getRedirectFromState(request: Request): string | null {
		const state = request.query?.state as string | undefined;
		if (!state) return null;

		try {
			const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8')) as {
				redirect?: string;
			};
			return decoded.redirect ?? null;
		} catch {
			return null;
		}
	}

	private getOAuthErrorMessage(err: Error & { code?: string }): string {
		const errorCode = err.code || '';

		switch (errorCode) {
			case 'invalid_grant':
				return 'OAuth authorization code expired or already used. Please try logging in again.';
			case 'invalid_client':
				return 'OAuth client configuration error. Please contact support.';
			case 'invalid_request':
				return 'Invalid OAuth request. Please try logging in again.';
			case 'access_denied':
				return 'Access was denied. Please grant the required permissions.';
			case 'redirect_uri_mismatch':
				return 'OAuth redirect URI mismatch. Please contact support.';
			default:
				return err.message || 'Google authentication failed. Please try again.';
		}
	}
}
