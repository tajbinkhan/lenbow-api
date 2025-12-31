import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Request } from 'express';

import { UAParser } from 'ua-parser-js';
import { DATABASE_CONNECTION } from '../../database/connection';
import schema from '../../database/schema';
import DrizzleService from '../../database/service';
import { SessionSchemaType } from '../../database/types';
import { SessionDataType } from './@types/auth.types';

@Injectable()
export class AuthSession extends DrizzleService {
	constructor(
		@Inject(DATABASE_CONNECTION)
		db: NodePgDatabase<typeof schema>,
	) {
		super(db);
	}

	getSessionInfo(request: Request) {
		const userAgent = request.headers['user-agent'] || 'Unknown';
		const parser = new UAParser(userAgent);

		const device = parser.getDevice(); // device type: mobile, tablet, desktop, etc.
		const os = parser.getOS(); // Android, iOS, MacOS, Windows...
		const browser = parser.getBrowser(); // Chrome, Safari, Firefox...

		const deviceType = device.type || 'desktop';

		const deviceName =
			(os.name || 'Unknown OS') +
			' ' +
			(os.version || '') +
			' - ' +
			(browser.name || 'Unknown Client');

		const ipAddress =
			request.headers['x-forwarded-for']?.toString().split(',')[0] ||
			request.socket.remoteAddress ||
			'Unknown';

		return {
			userAgent: `${parser.getBrowser().name} - ${parser.getBrowser().version}`,
			deviceType,
			deviceName,
			ipAddress,
		};
	}

	async createSession(data: SessionDataType): Promise<string> {
		const session = await this.getDb()
			.insert(schema.sessions)
			.values(data)
			.returning()
			.then(data => data[0]);

		return session.token;
	}

	async validateSession(
		userId: number,
		sessionKeyOrId: string | number,
	): Promise<SessionSchemaType> {
		const condition =
			typeof sessionKeyOrId === 'number'
				? eq(schema.sessions.id, sessionKeyOrId)
				: eq(schema.sessions.token, sessionKeyOrId);

		const session = await this.getDb().query.sessions.findFirst({
			where: and(condition, eq(schema.sessions.userId, userId)),
		});

		if (!session) throw new UnauthorizedException('Invalid session token');

		if (session.isRevoked) throw new UnauthorizedException('Session has been revoked');

		if (session.expiresAt < new Date()) throw new UnauthorizedException('Session has expired');

		return session;
	}

	async revokeSession(userId: number, sessionKeyOrId: string | number): Promise<boolean> {
		const condition =
			typeof sessionKeyOrId === 'number'
				? eq(schema.sessions.id, sessionKeyOrId)
				: eq(schema.sessions.token, sessionKeyOrId);

		await this.validateSession(userId, sessionKeyOrId);

		await this.getDb()
			.update(schema.sessions)
			.set({ isRevoked: true })
			.where(and(condition, eq(schema.sessions.userId, userId)));

		return true;
	}

	async revokeAllUserSessions(userId: number): Promise<number> {
		const result = await this.getDb()
			.update(schema.sessions)
			.set({ isRevoked: true })
			.where(and(eq(schema.sessions.userId, userId), eq(schema.sessions.isRevoked, false)))
			.returning();

		return result.length;
	}

	async listOfUserSessions(userId: number): Promise<SessionSchemaType[]> {
		const sessions = await this.getDb().query.sessions.findMany({
			where: eq(schema.sessions.userId, userId),
			orderBy: desc(schema.sessions.createdAt),
		});

		return sessions;
	}
}
