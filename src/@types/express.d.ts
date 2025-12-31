import { UserSchemaType } from '../database/types';

declare global {
	namespace Express {
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface User extends Omit<UserSchemaType, 'password'> {}

		interface Request {
			user?: User;
		}
	}
}
