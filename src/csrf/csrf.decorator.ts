import { SetMetadata } from '@nestjs/common';
import { SKIP_CSRF_KEY } from './csrf.guard';

/**
 * Decorator to skip CSRF validation on specific routes
 * @example
 * @SkipCsrf()
 * @Get('public-endpoint')
 * publicRoute() {}
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
