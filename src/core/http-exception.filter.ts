import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
	catch(exception: HttpException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
		const status = exception.getStatus();
		const exceptionResponse = exception.getResponse();

		const baseResponse = {
			statusCode: status,
			message: exception.message,
			timestamp: new Date().toISOString(),
			path: request.url,
		};

		// If the exception response is an object with additional properties, merge them
		const responsePayload =
			typeof exceptionResponse === 'object' && exceptionResponse !== null
				? { ...baseResponse, ...exceptionResponse }
				: baseResponse;

		response.status(status).json(responsePayload);
	}
}
