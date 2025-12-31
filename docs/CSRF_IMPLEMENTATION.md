# CSRF Protection Implementation

## Overview

This project uses a professional, type-safe CSRF protection implementation with NestJS dependency
injection.

## Architecture

### Files

- `csrf.service.ts` - Injectable service with typed ConfigService integration
- `csrf.module.ts` - Global module exporting CSRF functionality
- `csrf.guard.ts` - Guard for automatic CSRF validation
- `csrf.decorator.ts` - Decorator to skip CSRF on specific routes

## Usage

### 1. Apply CSRF Guard Globally (Recommended)

In `main.ts`:

```typescript
import { NestFactory, Reflector } from '@nestjs/core';

import { AppModule } from './app.module';
import { CsrfGuard } from './core/csrf.guard';
import { CsrfService } from './core/csrf.service';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Apply CSRF guard globally
	const reflector = app.get(Reflector);
	const csrfService = app.get(CsrfService);
	app.useGlobalGuards(new CsrfGuard(csrfService, reflector));

	await app.listen(3000);
}
bootstrap();
```

### 2. Generate CSRF Token Endpoint

```typescript
import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { CsrfService } from './core/csrf.service';
import { SkipCsrf } from './core/csrf.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly csrfService: CsrfService) {}

  @SkipCsrf()
  @Get('csrf-token')
  getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.csrfService.generateCsrfToken(req, res);
    return { csrfToken: token };
  }
}
```

### 3. Protected Routes (Automatic)

All routes are automatically protected by the global guard:

```typescript
@Controller('users')
export class UsersController {
  @Post() // Automatically CSRF protected
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
```

### 4. Skip CSRF Protection (When Needed)

```typescript
@Controller('webhooks')
export class WebhooksController {
  @SkipCsrf() // Skip CSRF for webhook endpoints
  @Post('github')
  handleGithubWebhook(@Body() payload: any) {
    return this.webhooksService.process(payload);
  }
}
```

### 5. Manual Validation (Advanced)

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { CsrfService } from './core/csrf.service';

@Injectable()
export class CustomService {
  constructor(private readonly csrfService: CsrfService) {}

  validateCustomRequest(req: Request) {
    if (!this.csrfService.validateRequest(req)) {
      throw new ForbiddenException('Invalid CSRF token');
    }
  }
}
```

## Client-Side Integration

### Fetch the token first:

```javascript
const response = await fetch('/auth/csrf-token');
const { csrfToken } = await response.json();
```

### Include in subsequent requests:

```javascript
fetch('/api/users', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'X-CSRF-Token': csrfToken,
	},
	body: JSON.stringify({ name: 'John' }),
});
```

## Benefits of This Implementation

✅ **Type-Safe**: Uses typed ConfigService with EnvType ✅ **Dependency Injection**: Proper NestJS
patterns ✅ **No `undefined` Issues**: ConfigService ensures env vars exist ✅ **Global Module**:
Available throughout the app ✅ **Flexible**: Use guard globally or per-route ✅ **Easy to Test**:
Injectable services are mockable ✅ **Production-Ready**: Follows enterprise best practices

## Configuration

Environment variables (validated via `env.ts`):

- `SECRET` - Required, used for CSRF token generation

## Security Notes

- CSRF protection is applied to all state-changing methods (POST, PUT, DELETE, PATCH)
- GET requests typically don't need CSRF protection
- Webhooks and public APIs should use `@SkipCsrf()`
- The token is stored in a cookie and must be sent in the `X-CSRF-Token` header
