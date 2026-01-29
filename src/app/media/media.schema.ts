import z from 'zod';
import { validateString } from '../../core/validators/commonRules';

export const mediaSchema = z.object({
	name: validateString('Media Name'),
	altText: validateString('Media Alt Text'),
});

export type MediaDto = z.infer<typeof mediaSchema>;
