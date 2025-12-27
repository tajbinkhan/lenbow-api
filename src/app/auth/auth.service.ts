import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CreateUser, UserWithoutPassword } from 'src/app/auth/@types/auth.types';
import { LoginDto } from 'src/app/auth/auth.schema';
import { AuthSession } from 'src/app/auth/auth.session';
import { GoogleProfile } from 'src/app/auth/strategies/google.strategy';
import { sessionTimeout } from 'src/core/constants';
import { CryptoService } from 'src/core/crypto/crypto.service';
import { DATABASE_CONNECTION } from 'src/database/connection';
import schema from 'src/database/schema';
import DrizzleService from 'src/database/service';
import { UserSchemaType } from 'src/database/types';

interface UserInformation {
	userId: number;
	email: string;
	userAgent: string;
	ipAddress: string;
	deviceName: string;
	deviceType: string;
	expirationTime?: number;
}

@Injectable()
export class AuthService extends DrizzleService {
	constructor(
		@Inject(DATABASE_CONNECTION)
		db: NodePgDatabase<typeof schema>,
		private readonly jwtService: JwtService,
		private readonly authSession: AuthSession,
		private readonly cryptoService: CryptoService,
	) {
		super(db);
	}

	async generateAccessToken(userInfo: UserInformation): Promise<string> {
		const sub = this.cryptoService.encrypt(userInfo.userId.toString());
		const email = this.cryptoService.encrypt(userInfo.email);

		const payload = { sub, email };
		const token = this.jwtService.sign(payload);

		const sessionToken = await this.authSession.createSession({
			userId: userInfo.userId,
			expiresAt: userInfo.expirationTime
				? new Date(userInfo.expirationTime)
				: new Date(Date.now() + sessionTimeout), // default 7 days
			userAgent: userInfo.userAgent,
			ipAddress: userInfo.ipAddress,
			deviceName: userInfo.deviceName,
			deviceType: userInfo.deviceType,
			token,
		});

		return sessionToken;
	}

	async findUserById(id: number): Promise<UserWithoutPassword> {
		const user = await this.getDb().query.users.findFirst({
			where: eq(schema.users.id, id),
		});

		if (!user) throw new UnauthorizedException('User not found');

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { password, ...userWithoutPassword } = user;
		return userWithoutPassword;
	}

	async findUserByPublicId(publicId: string): Promise<UserWithoutPassword> {
		const user = await this.getDb().query.users.findFirst({
			where: eq(schema.users.publicId, publicId),
		});

		if (!user) throw new UnauthorizedException('User not found');

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { password, ...userWithoutPassword } = user;
		return userWithoutPassword;
	}

	async findUserByEmail(email: string): Promise<UserWithoutPassword> {
		const user = await this.getDb().query.users.findFirst({
			where: eq(schema.users.email, email),
		});

		if (!user) throw new UnauthorizedException('User not found');

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { password, ...userWithoutPassword } = user;
		return userWithoutPassword;
	}

	async checkIfUserExists(email: string): Promise<boolean> {
		const user = await this.getDb().query.users.findFirst({
			where: eq(schema.users.email, email),
		});

		return !!user;
	}

	async validateUser(data: LoginDto): Promise<Omit<UserSchemaType, 'password'>> {
		const checkUserByEmail = await this.getDb().query.users.findFirst({
			where: eq(schema.users.email, data.email),
		});

		if (!checkUserByEmail) throw new BadRequestException('User with this email does not exist');

		if (!checkUserByEmail.emailVerified) throw new UnauthorizedException('Email not verified');

		if (!checkUserByEmail.password)
			throw new UnauthorizedException('User does not have a password set');

		const isPasswordValid = await bcrypt.compare(data.password, checkUserByEmail.password);

		if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { password, ...userWithoutPassword } = checkUserByEmail;

		return userWithoutPassword;
	}

	async createUser(data: CreateUser): Promise<UserWithoutPassword> {
		let hashedPassword: string | undefined = undefined;
		if (data.password) hashedPassword = await bcrypt.hash(data.password, 10);

		const newUser = await this.getDb()
			.insert(schema.users)
			.values({
				...data,
				password: hashedPassword,
			})
			.returning()
			.then(rows => rows[0]);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { password, ...userWithoutPassword } = newUser;

		return userWithoutPassword;
	}

	/**
	 * Find or create a user from Google OAuth profile
	 * Also creates/updates the OAuth account link
	 */
	async findOrCreateGoogleUser(profile: GoogleProfile): Promise<UserWithoutPassword> {
		// First, check if there's an existing account link for this Google ID
		const existingAccount = await this.getDb().query.accounts.findFirst({
			where: and(
				eq(schema.accounts.providerId, 'google'),
				eq(schema.accounts.accountId, profile.googleId),
			),
		});

		if (existingAccount) {
			// Update access and refresh tokens
			await this.getDb()
				.update(schema.accounts)
				.set({
					accessToken: profile.accessToken,
					refreshToken: profile.refreshToken,
				})
				.where(
					and(
						eq(schema.accounts.providerId, 'google'),
						eq(schema.accounts.accountId, profile.googleId),
					),
				);
			// User already linked, fetch and return user
			return this.findUserById(existingAccount.userId);
		}

		// Check if a user with this email already exists
		const existingUser = await this.getDb().query.users.findFirst({
			where: eq(schema.users.email, profile.email),
		});

		if (existingUser) {
			// Link the Google account to the existing user
			await this.getDb().insert(schema.accounts).values({
				accountId: profile.googleId,
				providerId: 'google',
				userId: existingUser.id,
				accessToken: profile.accessToken,
				refreshToken: profile.refreshToken,
			});

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { password, ...userWithoutPassword } = existingUser;
			return userWithoutPassword;
		}

		// Create a new user
		const newUser = await this.createUser({
			name: profile.name,
			email: profile.email,
			password: null,
			image: profile.picture,
			emailVerified: true, // Google verified email
			phone: null,
		});

		// Create the account link
		await this.getDb().insert(schema.accounts).values({
			accountId: profile.googleId,
			providerId: 'google',
			userId: newUser.id,
		});

		return newUser;
	}
}
