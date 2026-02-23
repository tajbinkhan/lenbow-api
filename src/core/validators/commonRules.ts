import { z } from 'zod';

import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { zodMessages } from '../messages';

// =======================
// 🔹 Helper: Create Error Config
// =======================
export const makeError = (
	name: string,
	type: 'required' | 'invalid' | 'limit',
	extra?: string,
): string => {
	switch (type) {
		case 'required':
			return zodMessages.error.required.fieldIsRequired(name);
		case 'invalid':
			return extra ? extra : zodMessages.error.invalid.invalidString(name);
		case 'limit':
			return extra ?? `${name} has invalid limit`;
		default:
			return `${name} is invalid`;
	}
};

// =======================
// 🔹 Base Validators
// =======================
const baseString = (
	name: string,
	opts?: { min?: number; max?: number; regex?: RegExp; regexMsg?: string },
) => {
	let schema = z
		.string({
			error: issue =>
				issue.input === undefined ? makeError(name, 'required') : makeError(name, 'invalid'),
		})
		.trim();

	if (opts?.min)
		schema = schema.min(opts.min, {
			error: makeError(name, 'limit', zodMessages.error.limit.stringMin(name, opts.min)),
		});

	if (opts?.max)
		schema = schema.max(opts.max, {
			error: makeError(name, 'limit', zodMessages.error.limit.stringMax(name, opts.max)),
		});

	if (opts?.regex)
		schema = schema.regex(opts.regex, { error: opts.regexMsg || makeError(name, 'invalid') });

	return schema;
};

const baseNumber = (name: string, opts?: { min?: number; positive?: boolean; int?: boolean }) => {
	let schema = z.coerce.number({
		error: issue =>
			issue.input === undefined
				? makeError(name, 'required')
				: zodMessages.error.invalid.invalidNumber(name),
	});

	if (opts?.min)
		schema = schema.min(opts.min, {
			error: makeError(name, 'limit', zodMessages.error.limit.numberMin(name, opts.min)),
		});

	if (opts?.positive) schema = schema.positive({ error: makeError(name, 'invalid') });
	if (opts?.int) schema = schema.int({ error: makeError(name, 'invalid') });

	return schema;
};

const baseBoolean = (name: string) =>
	z.boolean({
		error: () => makeError(name, 'required'),
	});

const baseEnum = <const T extends readonly [string, ...string[]]>(name: string, values: T) =>
	z.enum(values, {
		error: () => zodMessages.error.invalid.invalidEnum(name, values),
	});

const baseDate = (name: string) =>
	z
		.union([z.string(), z.date()], {
			error: () => makeError(name, 'invalid', `${name} must be a string or Date`),
		})
		.refine(
			value => {
				const date = value instanceof Date ? value : new Date(value);
				return !isNaN(date.getTime());
			},
			{
				error: zodMessages.error.invalid.invalidDate(name),
			},
		)
		.transform(value => (value instanceof Date ? value : new Date(value)));

const baseEmail = (
	name: string,
	opts?: { min?: number; max?: number; regex?: RegExp; regexMsg?: string },
) => {
	let schema = z
		.email({
			error: issue =>
				issue.input === undefined ? makeError(name, 'required') : makeError(name, 'invalid'),
		})
		.trim();

	if (opts?.min)
		schema = schema.min(opts.min, {
			error: makeError(name, 'limit', zodMessages.error.limit.stringMin(name, opts.min)),
		});

	if (opts?.max)
		schema = schema.max(opts.max, {
			error: makeError(name, 'limit', zodMessages.error.limit.stringMax(name, opts.max)),
		});

	if (opts?.regex)
		schema = schema.regex(opts.regex, { error: opts.regexMsg || makeError(name, 'invalid') });

	return schema;
};

const baseUrl = (
	name: string,
	opts?: { min?: number; max?: number; regex?: RegExp; regexMsg?: string },
) => {
	let schema = z
		.url({
			error: issue =>
				issue.input === undefined ? makeError(name, 'required') : makeError(name, 'invalid'),
		})
		.trim();

	if (opts?.min)
		schema = schema.min(opts.min, {
			error: makeError(name, 'limit', zodMessages.error.limit.stringMin(name, opts.min)),
		});

	if (opts?.max)
		schema = schema.max(opts.max, {
			error: makeError(name, 'limit', zodMessages.error.limit.stringMax(name, opts.max)),
		});

	if (opts?.regex)
		schema = schema.regex(opts.regex, { error: opts.regexMsg || makeError(name, 'invalid') });

	return schema;
};

const baseUUID = (name: string) =>
	z.uuid({
		version: 'v4',
		error: zodMessages.error.invalid.invalidUUID
			? zodMessages.error.invalid.invalidUUID(name)
			: `${name} must be a valid UUID`,
	});

// =======================
// 🔹 Utility Validators (Union & Array)
// =======================
const baseArray = <T extends z.ZodTypeAny>(
	name: string,
	itemSchema: T,
	opts?: { min?: number; max?: number },
) => {
	let schema = z.array(itemSchema, {
		error: () =>
			zodMessages.error.invalid.invalidArray
				? zodMessages.error.invalid.invalidArray(name)
				: `${name} must be an array`,
	});

	if (opts?.min)
		schema = schema.min(opts.min, {
			error: makeError(
				name,
				'limit',
				zodMessages.error.limit.arrayMin
					? zodMessages.error.limit.arrayMin(name, opts.min)
					: `${name} must have at least ${opts.min} items`,
			),
		});

	if (opts?.max)
		schema = schema.max(opts.max, {
			error: makeError(
				name,
				'limit',
				zodMessages.error.limit.arrayMax
					? zodMessages.error.limit.arrayMax(name, opts.max)
					: `${name} must have at most ${opts.max} items`,
			),
		});

	return schema;
};

const baseUnion = <T extends readonly [z.ZodTypeAny, ...z.ZodTypeAny[]]>(
	name: string,
	schemas: T,
) =>
	z.union(schemas, {
		error: () =>
			zodMessages.error.invalid.invalidUnion
				? zodMessages.error.invalid.invalidUnion(name)
				: `${name} must match one of the allowed types`,
	});

// =======================
// 🔹 Field-Specific Validators
// =======================
export const validateString = baseString;
export const validateNumber = baseNumber;
export const validatePositiveNumber = (name: string) =>
	baseNumber(name, { min: 1, positive: true, int: true });
export const validateBoolean = baseBoolean;
export const validateEnum = baseEnum;
export const validateDate = baseDate;
export const validateArray = baseArray;
export const validateUnion = baseUnion;

// Specialized validators for common patterns
export const validateStringOrArray = (name: string, itemOpts?: Parameters<typeof baseString>[1]) =>
	baseUnion(name, [
		baseString(name, itemOpts),
		baseArray(name, baseString(`${name} item`, itemOpts)),
	]);

export const validateEmailOrArray = (name: string) =>
	baseUnion(name, [validateEmail, baseArray(name, validateEmail)]);

// Environment-specific validators (for string-to-type conversion)
export const validateEnvNumber = (
	name: string,
	opts?: { min?: number; max?: number; int?: boolean },
) => {
	let schema = baseString(name, { min: 1 })
		.refine(value => !isNaN(Number(value)), {
			error: zodMessages.error.invalid.invalidNumber(name),
		})
		.transform(value => Number(value));

	if (opts?.min !== undefined)
		schema = schema.refine(value => value >= opts.min!, {
			error: makeError(
				name,
				'limit',
				zodMessages.error.limit.numberMin
					? zodMessages.error.limit.numberMin(name, opts.min)
					: `${name} must be at least ${opts.min}`,
			),
		});

	if (opts?.max !== undefined)
		schema = schema.refine(value => value <= opts.max!, {
			error: makeError(
				name,
				'limit',
				zodMessages.error.limit.numberMax
					? zodMessages.error.limit.numberMax(name, opts.max)
					: `${name} must be at most ${opts.max}`,
			),
		});

	if (opts?.int)
		schema = schema.refine(value => Number.isInteger(value), {
			error: makeError(name, 'invalid', `${name} must be an integer`),
		});

	return schema;
};

export const validateClientNumber = (name: string, min = 1) =>
	baseString(name)
		.refine(value => !isNaN(Number(value)), {
			error: zodMessages.error.invalid.invalidNumber(name),
		})
		.or(baseNumber(name, { min }));

export const validateSelectObject = (name: string) =>
	z
		.object(
			{
				value: baseString(name),
				label: baseString(name),
			},
			{
				error: () => zodMessages.error.invalid.invalidObject(name),
			},
		)
		.or(z.null());

export const validateUsername = baseString('Username', {
	min: 1,
	max: 20,
	regex: /^[a-zA-Z0-9_]*$/,
	regexMsg: zodMessages.error.invalid.invalidUsername('Username'),
});

export const validateEmail = baseEmail('Email', { max: 255 });

export const validateUrl = (name: string) => baseUrl(name, { max: 2048 });

export const validateUUID = (name: string) => baseUUID(name);

// export const phoneWithCountryCodeRegex = /^\+?[1-9]\d{1,14}$/;
// export const validatePhoneNumber = (name: string) =>
// 	baseString(name, { min: 1 })
// 		.refine(value => phoneWithCountryCodeRegex.test(value), {
// 			error: zodMessages.error.invalid.invalidPhoneNumber(name),
// 		})
// 		.transform(value => value.trim());

export const validatePhoneNumber = (name = 'Phone') =>
	baseString(name)
		.trim()
		.superRefine((val, ctx) => {
			// allow empty if you want optional phone; otherwise remove this
			if (!val) return;

			// Best practice: require international format by default
			// Example: +8801712345678, +14155552671
			const phone = parsePhoneNumberFromString(val);

			if (!phone || !phone.isValid()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `${name} is not a valid phone number`,
				});
				return;
			}

			// Enforce E.164 output (canonical)
			// If you want to require the user input itself to start with '+', uncomment:
			// if (!val.startsWith("+")) { ...issue... }

			// Optionally normalize elsewhere:
			// const e164 = phone.number; // "+14155552671"
		});

export const validateUsernameOrEmail = baseString('Username or email', { min: 1, max: 255 }).refine(
	value => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		const usernameRegex = /^[a-zA-Z0-9_]*$/;
		if (value.includes('@')) return emailRegex.test(value);
		return usernameRegex.test(value) && value.length <= 20;
	},
	{ error: zodMessages.error.invalid.invalidUsernameOrEmail('Username or email') },
);

const passwordRules = [
	{ regex: /[A-Z]/, msg: (name: string) => zodMessages.error.invalid.invalidUpperCase(name) },
	{ regex: /[a-z]/, msg: (name: string) => zodMessages.error.invalid.invalidLowerCase(name) },
	{ regex: /\d/, msg: (name: string) => zodMessages.error.invalid.invalidNumericCase(name) },
];

const passwordSchema = (name: string) =>
	baseString(name, { min: 6 }).superRefine((val, ctx) => {
		passwordRules.forEach(rule => {
			if (!rule.regex.test(val)) {
				ctx.addIssue({ code: 'custom', message: rule.msg(name) });
			}
		});
	});

export const validatePassword = passwordSchema('Password');
export const validateNewPassword = passwordSchema('New Password');
export const validateConfirmPassword = passwordSchema('Confirm Password');

// =======================
// 🔹 Meta SEO Schema Example
// =======================
export const metaSeoSchema = z.object({
	metaTitle: baseString('Meta Title', { max: 255 }).optional(),
	metaDescription: baseString('Meta Description', { max: 500 }).optional(),
	metaKeywords: baseString('Meta Keywords').optional(),
	metaThumbnailId: validatePositiveNumber('Meta Thumbnail ID').optional(),
});
