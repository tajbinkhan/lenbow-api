import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CsrfService } from './csrf.service';

export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * Guard to protect routes with CSRF validation
 * Use @SkipCsrf() decorator to bypass on specific routes
 */
@Injectable()
export class CsrfGuard implements CanActivate {
	constructor(
		private readonly csrfService: CsrfService,
		private readonly reflector: Reflector,
	) {}

	canActivate(context: ExecutionContext): boolean {
		const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (skipCsrf) {
			return true;
		}

		const request = context.switchToHttp().getRequest<Request>();

		// Skip CSRF validation for safe methods (GET, HEAD, OPTIONS)
		if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
			return true;
		}

		try {
			const requestValidation = this.csrfService.validateRequest(request);
			if (requestValidation) {
				return true;
			}
			throw new ForbiddenException(
				'Invalid CSRF token. Perhaps your browser blocked 3rd-party cookies. Please allow 3rd-party cookies or try a different browser. If the problem persists, please contact support.',
			);
		} catch {
			throw new ForbiddenException(
				'Invalid CSRF token. Perhaps your browser blocked 3rd-party cookies. Please allow 3rd-party cookies or try a different browser. If the problem persists, please contact support.',
			);
		}
	}
}
