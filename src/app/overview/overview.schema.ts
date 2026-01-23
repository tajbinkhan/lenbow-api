import z from 'zod';
import { validatePositiveNumber } from '../../core/validators/commonRules';

export const overviewQuerySchema = z.object({
	recentLimit: validatePositiveNumber('Recent Limit').default(10).optional(),
	upcomingLimit: validatePositiveNumber('Upcoming Limit').default(5).optional(),
	actionRequiredLimit: validatePositiveNumber('Action Required Limit').default(10).optional(),
	monthsBack: validatePositiveNumber('Months Back').default(6).optional(),
});

export type OverviewQuerySchemaType = z.infer<typeof overviewQuerySchema>;
