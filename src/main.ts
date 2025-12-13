import { NestFactory, Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';
import { ApiResponseInterceptor } from 'src/core/api-response.interceptor';
import { HttpExceptionFilter } from 'src/core/http-exception.filter';
import { appLogger, displayStartupInfo } from 'src/core/logger';
import { logAllRoutes } from 'src/core/route-logger';
import { CsrfGuard } from 'src/csrf/csrf.guard';
import { CsrfService } from 'src/csrf/csrf.service';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Enable cookie parsing for CSRF tokens
	app.use(cookieParser());

	// Add request logging middleware
	app.use(appLogger);

	// Apply global exception filter for custom error responses
	app.useGlobalFilters(new HttpExceptionFilter());

	// Apply global response interceptor for consistent response format
	app.useGlobalInterceptors(new ApiResponseInterceptor());

	// Apply CSRF guard globally
	const reflector = app.get(Reflector);
	const csrfService = app.get(CsrfService);
	app.useGlobalGuards(new CsrfGuard(csrfService, reflector));

	const port = process.env.PORT ?? 3000;

	// Initialize and start the server
	await app.init();
	await app.listen(port);

	// Display startup information
	displayStartupInfo(port);

	// Log all routes (only in development mode)
	// Must be called after app.listen() to ensure all routes are registered
	logAllRoutes(app, {
		saveToFile: true,
		logToConsole: false,
	});
}
bootstrap();
