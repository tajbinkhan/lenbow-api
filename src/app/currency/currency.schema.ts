import z from 'zod';
import { validateString } from '../../core/validators/commonRules';

export const updateCurrency = z.object({
	currency: validateString('Currency', { min: 3, max: 3 }),
});

export type UpdateCurrencyDto = z.infer<typeof updateCurrency>;
