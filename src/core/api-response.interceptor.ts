import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Pagination {
	totalItems: number;
	limit: number;
	offset: number;
	currentPage: number;
	totalPages: number;
	hasPrevPage: boolean;
	hasNextPage: boolean;
	prevPage: number | null;
	nextPage: number | null;
}

export interface CursorPagination {
	totalItems: number;
	hasMoreBefore: boolean;
	hasMoreAfter: boolean;
	beforeCursor: string | number | null;
	afterCursor: string | number | null;
	count: number;
}

export interface ApiResponse<T> {
	statusCode: number;
	message: string;
	data?: T;
	timestamp: string;
	path: string;
	pagination?: Pagination | CursorPagination;
}

export interface PaginatedResponse<T> {
	data: T[];
	pagination?: Pagination | CursorPagination;
}

export function createApiResponse<T>(
	statusCode: number,
	message: string,
	data?: T,
	pagination?: Pagination | CursorPagination,
): ApiResponse<T> {
	return {
		statusCode,
		message,
		data,
		pagination,
		timestamp: new Date().toISOString(),
		path: '', // Will be set by interceptor
	};
}

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
	intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
		const ctx = context.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();

		return next.handle().pipe(
			map<T, ApiResponse<T>>(data => {
				// If the controller already returned an ApiResponse, update its path
				if (
					data &&
					typeof data === 'object' &&
					'statusCode' in data &&
					'message' in data &&
					'timestamp' in data
				) {
					const response = data as Partial<ApiResponse<T>>;
					return {
						statusCode: response.statusCode!,
						message: response.message!,
						data: response.data,
						pagination: response.pagination,
						timestamp: response.timestamp!,
						path: request.url,
					};
				}

				// Otherwise, wrap it
				return {
					...createApiResponse(response.statusCode, 'Success', data),
					path: request.url,
				};
			}),
		);
	}
}
