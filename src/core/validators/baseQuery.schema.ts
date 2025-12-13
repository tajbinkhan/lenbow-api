import { z } from 'zod';

import { validateEnum, validatePositiveNumber, validateString } from './commonRules';

export type SortableField = { name: string; queryName: string };

export const baseQuerySchema = (sortableFields: readonly SortableField[]) => {
	const sortByValues = sortableFields.map(field => field.name) as [string, ...string[]];

	const getSortField = (sortBy?: string) => {
		if (!sortBy) return undefined;
		return sortableFields.find(field => field.name === sortBy)?.queryName;
	};

	return z.object({
		page: validatePositiveNumber('Page').optional(),
		limit: validatePositiveNumber('Limit').max(500, 'Limit must not exceed 500').optional(),
		sortBy: validateEnum('Sort By', sortByValues)
			.optional()
			.transform((val: string | undefined) => getSortField(val)), // Transform directly here
		sortOrder: validateEnum('Sort Order', ['asc', 'desc']).optional(),
		search: validateString('Search').optional(),
		from: validateString('From Date').optional(),
		to: validateString('To Date').optional(),
	});
};
