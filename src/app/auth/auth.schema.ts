import {
	validateEmail,
	validatePassword,
	validatePhoneNumber,
	validateString,
} from 'src/core/validators/commonRules';
import z from 'zod';

export const loginSchema = z.object({
	email: validateEmail,
	password: validateString('Password'),
});

export const registerSchema = z.object({
	name: validateString('Name').optional(),
	email: validateEmail,
	password: validatePassword,
	image: validateString('Image').optional(),
	phone: validatePhoneNumber('Phone').optional(),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
