import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpStatus,
	Post,
	Request,
	Res,
	UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request as ExpressRequest, Response } from 'express';
import type {
	CreateUser,
	UserWithoutPassword,
	UserWithoutPasswordResponse,
} from 'src/app/auth/@types/auth.types';
import { GoogleAuthGuard, JwtAuthGuard } from 'src/app/auth/auth.guard';
import {
	type LoginDto,
	loginSchema,
	type RegisterDto,
	registerSchema,
} from 'src/app/auth/auth.schema';
import { AuthSession } from 'src/app/auth/auth.session';
import { GoogleProfile } from 'src/app/auth/strategies/google.strategy';
import { type ApiResponse, createApiResponse } from 'src/core/api-response.interceptor';
import AppHelpers from 'src/core/app.helper';
import { sessionTimeout } from 'src/core/constants';
import { EnvType } from 'src/core/env';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
	constructor(
		private authService: AuthService,
		private authSession: AuthSession,
		private configService: ConfigService<EnvType, true>,
	) {}

	@Post('login')
	async login(
		@Body() loginDto: LoginDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<UserWithoutPasswordResponse>> {
		const validate = loginSchema.safeParse(loginDto);
		if (!validate.success) {
			throw new BadRequestException(validate.error.issues.map(issue => issue.message).join(', '));
		}

		const user = await this.authService.validateUser(validate.data);

		const userDeviceInfo = this.authSession.getSessionInfo(request);

		const accessToken = await this.authService.generateAccessToken({
			userId: user.id,
			email: user.email,
			userAgent: userDeviceInfo.userAgent,
			ipAddress: userDeviceInfo.ipAddress,
			deviceName: userDeviceInfo.deviceName,
			deviceType: userDeviceInfo.deviceType,
		});

		// Set cookie
		request.res?.cookie('access-token', accessToken, {
			httpOnly: true,
			secure: AppHelpers.sameSiteCookieConfig().secure,
			sameSite: AppHelpers.sameSiteCookieConfig().sameSite,
			maxAge: sessionTimeout,
		});

		const responseUser: UserWithoutPasswordResponse = {
			...user,
			id: user.publicId,
		};

		return createApiResponse(HttpStatus.OK, 'Login successful', responseUser);
	}

	@Post('register')
	async register(
		@Body() registerDto: RegisterDto,
	): Promise<ApiResponse<UserWithoutPasswordResponse>> {
		const validate = registerSchema.safeParse(registerDto);
		if (!validate.success) {
			throw new BadRequestException(
				`Validation failed: ${validate.error.issues.map(issue => issue.message).join(', ')}`,
			);
		}

		const userData: CreateUser = {
			name: validate.data.name || null,
			email: validate.data.email,
			password: validate.data.password,
			image: validate.data.image || null,
			emailVerified: false,
			phone: validate.data.phone || null,
		};

		const existingUser = await this.authService.checkIfUserExists(userData.email);

		if (existingUser) throw new BadRequestException('User with this email already exists');

		const user = await this.authService.createUser(userData);

		const responseUser: UserWithoutPasswordResponse = {
			...user,
			id: user.publicId,
		};

		return createApiResponse(HttpStatus.CREATED, 'User registered successfully', responseUser);
	}

	@UseGuards(JwtAuthGuard)
	@Post('logout')
	async logout(@Request() request: ExpressRequest): Promise<ApiResponse<null>> {
		const userId = request.user?.id;
		const sessionToken = request.cookies['access-token'] as string | undefined;

		if (!userId || !sessionToken) throw new BadRequestException('No active session found');

		await this.authSession.revokeSession(userId, sessionToken);

		request.res?.clearCookie('access-token', {
			httpOnly: true,
			secure: AppHelpers.sameSiteCookieConfig().secure,
			sameSite: AppHelpers.sameSiteCookieConfig().sameSite,
		});
		return createApiResponse(HttpStatus.OK, 'Logout successful', null);
	}

	@UseGuards(JwtAuthGuard)
	@Get('me')
	getProfile(@Request() req: ExpressRequest): ApiResponse<UserWithoutPasswordResponse> {
		const user = req.user as UserWithoutPassword;
		const responseUser: UserWithoutPasswordResponse = {
			...user,
			id: user.publicId,
		};
		return createApiResponse(HttpStatus.OK, 'User profile fetched successfully', responseUser);
	}

	/**
	 * Initiates Google OAuth login flow
	 * Redirects user to Google's consent screen
	 */
	@Get('google')
	@UseGuards(GoogleAuthGuard)
	googleLogin(): void {
		// Guard handles the redirect to Google
	}

	/**
	 * Google OAuth callback handler
	 * Creates/finds user and sets session cookie
	 */
	@Get('google/callback')
	@UseGuards(GoogleAuthGuard)
	async googleCallback(
		@Request() request: ExpressRequest,
		@Res() response: Response,
	): Promise<void> {
		const googleProfile = request.user as unknown as GoogleProfile;

		const user = await this.authService.findOrCreateGoogleUser(googleProfile);
		const userDeviceInfo = this.authSession.getSessionInfo(request);

		const accessToken = await this.authService.generateAccessToken({
			userId: user.id,
			email: user.email,
			userAgent: userDeviceInfo.userAgent,
			ipAddress: userDeviceInfo.ipAddress,
			deviceName: userDeviceInfo.deviceName,
			deviceType: userDeviceInfo.deviceType,
		});

		request.res?.cookie('access-token', accessToken, {
			httpOnly: true,
			secure: AppHelpers.sameSiteCookieConfig().secure,
			sameSite: AppHelpers.sameSiteCookieConfig().sameSite,
			maxAge: sessionTimeout,
		});

		const state = request.query.state as string | undefined;
		let redirectUrl: string | null = null;

		if (state) {
			try {
				const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8')) as {
					redirect?: string;
				};

				if (decoded.redirect) {
					const allowedOrigins = this.configService.get('ORIGIN_URL', { infer: true });
					const allowedOriginsArray = allowedOrigins.split(',').map(origin => origin.trim());

					try {
						const redirectUrlObj = new URL(decoded.redirect);
						const redirectOrigin = redirectUrlObj.origin;

						if (allowedOriginsArray.includes(redirectOrigin)) {
							redirectUrl = decoded.redirect;
						}
					} catch {
						// Invalid URL, ignore
					}
				}
			} catch {
				// Invalid state, use default redirect
			}
		}

		const responseUser: UserWithoutPasswordResponse = {
			...user,
			id: user.publicId,
		};

		// Redirect to custom URL or return JSON response
		if (redirectUrl) {
			response.redirect(redirectUrl);
		} else {
			response.json(createApiResponse(HttpStatus.OK, 'Google login successful', responseUser));
		}
	}
}
