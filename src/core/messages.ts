export const zodMessages = {
	error: {
		required: {
			fieldIsRequired: (field: string) => `${field} is required.`,
		},
		limit: {
			stringMin: (field: string, limit: number) => `${field} must be at least ${limit} characters.`,
			stringMax: (field: string, limit: number) => `${field} must not exceed ${limit} characters.`,
			arrayMin: (field: string, limit: number) => `${field} must have at least ${limit} items.`,
			arrayMax: (field: string, limit: number) => `${field} must not exceed ${limit} items.`,
			numberMin: (field: string, limit: number) => `${field} must be at least ${limit}.`,
			numberMax: (field: string, limit: number) => `${field} must not exceed ${limit}.`,
			fileSize: (field: string, limit: string) => `${field} must not exceed ${limit}.`,
			length: (field: string, limit: number) =>
				`${field} must be exactly ${limit} characters long.`,
		},
		invalid: {
			invalidUrl: (field: string) => `${field} must be a valid URL.`,
			invalidString: (field: string) => `${field} must be a string.`,
			invalidEmail: (field: string) => `${field} must be a valid email address.`,
			invalidNumber: (field: string) => `${field} must be a number.`,
			invalidBoolean: (field: string) => `${field} must be a boolean.`,
			invalidDate: (field: string) => `${field} must be a date.`,
			invalidArray: (field: string) => `${field} must be an array.`,
			invalidObject: (field: string) => `${field} must be an object.`,
			invalidEnum: (field: string, values: readonly string[]) =>
				`${field} must be one of the following values: ${values.join(', ')}.`,
			invalidUnion: (field: string) => `${field} must be one of the specified types.`,
			invalidIntersection: (field: string) =>
				`${field} must be a combination of the specified types.`,
			invalidTuple: (field: string) => `${field} must be a tuple.`,
			invalidRecord: (field: string) => `${field} must be a record.`,
			invalidLiteral: (field: string, value: string) =>
				`${field} must be the literal value: ${value}.`,
			invalidNull: (field: string) => `${field} must be null.`,
			invalidUndefined: (field: string) => `${field} must be undefined.`,
			invalidOptional: (field: string) => `${field} must be optional.`,
			invalidNullable: (field: string) => `${field} must be nullable.`,
			invalidPromise: (field: string) => `${field} must be a promise.`,
			invalidFunction: (field: string) => `${field} must be a function.`,
			invalidClass: (field: string) => `${field} must be a class.`,
			invalidUnknown: (field: string) => `${field} must be unknown.`,
			invalidNever: (field: string) => `${field} must be never.`,
			invalidVoid: (field: string) => `${field} must be void.`,
			invalidAny: (field: string) => `${field} must be any.`,
			invalidUnknownKeys: (field: string) => `${field} must have unknown keys.`,
			invalidFile: (field: string) => `${field} must be a file.`,
			invalidFileSize: (field: string, limit: number) => `${field} must not exceed ${limit} bytes.`,
			invalidFileType: (field: string, type: string) => `${field} must be of type ${type}.`,
			invalidUpperCase: (field: string) => `${field} must be at least one upper case.`,
			invalidLowerCase: (field: string) => `${field} must be at least one lower case.`,
			invalidNumericCase: (field: string) => `${field} must be at least one number.`,
			invalidPhoneNumber: (field: string) => `${field} must be a valid phone number.`,
			invalidUsername: (field: string) =>
				`${field} must contain only letters, numbers, and underscores.`,
			invalidUsernameOrEmail: (field: string) =>
				`${field} must be a valid username or email address.`,
			invalidLength: (field: string, length: number) =>
				`${field} must be exactly ${length} characters long.`,
			invalidObjectId: (field: string) => `${field} must be a valid ObjectId.`,
		},
	},
};
