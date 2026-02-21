import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	Post,
	Put,
	Req,
	Request,
	Res,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request as ExpressRequest, Response } from 'express';
import { memoryStorage } from 'multer';
import { type ApiResponse, createApiResponse } from '../../core/api-response.interceptor';
import AppHelpers from '../../core/app.helper';
import { CloudinaryImageService } from '../../core/cloudinary/upload';
import { sessionTimeout } from '../../core/constants';
import { EnvType } from '../../core/env';
import { MediaDataType } from '../media/@types/media.types';
import { FILE_SIZE_LIMIT, singleFileSchema, ZodFileValidationPipe } from '../media/media.pipe';
import type {
	CreateUser,
	UserWithoutPassword,
	UserWithoutPasswordResponse,
} from './@types/auth.types';
import { GoogleAuthGuard, JwtAuthGuard } from './auth.guard';
import {
	type LoginDto,
	loginSchema,
	type RegisterDto,
	registerSchema,
	type UpdateProfileDto,
	updateProfileSchema,
} from './auth.schema';
import { AuthService } from './auth.service';
import { AuthSession } from './auth.session';
import { GoogleProfile } from './strategies/google.strategy';

@Controller('auth')
export class AuthController {
	private readonly cloudinaryImageService: CloudinaryImageService;

	constructor(
		private authService: AuthService,
		private authSession: AuthSession,
		private configService: ConfigService<EnvType, true>,
	) {
		this.cloudinaryImageService = new CloudinaryImageService({
			cloudName: this.configService.get('CLOUDINARY_CLOUD_NAME'),
			apiKey: this.configService.get('CLOUDINARY_API_KEY'),
			apiSecret: this.configService.get('CLOUDINARY_API_SECRET'),
			folder: 'user_profiles',
		});
	}

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

		const cookieConfig = AppHelpers.sameSiteCookieConfig(this.configService);

		// Set cookie
		request.res?.cookie('access-token', accessToken, {
			httpOnly: true,
			secure: cookieConfig.secure,
			sameSite: cookieConfig.sameSite,
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
			imageInformation: null,
			emailVerified: false,
			phone: validate.data.phone || null,
			currencyCode: null,
			receiveTransactionEmails: true,
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

		const cookieConfig = AppHelpers.sameSiteCookieConfig(this.configService);

		request.res?.clearCookie('access-token', {
			httpOnly: true,
			secure: cookieConfig.secure,
			sameSite: cookieConfig.sameSite,
		});
		return createApiResponse(HttpStatus.OK, 'Logout successful', null);
	}

	@UseGuards(JwtAuthGuard)
	@Get('me')
	getProfile(@Request() req: ExpressRequest): ApiResponse<UserWithoutPasswordResponse> {
		const user = req.user as UserWithoutPassword;
		const responseUser: UserWithoutPasswordResponse = {
			...user,
			imageInformation: null,
			id: user.publicId,
		};
		return createApiResponse(HttpStatus.OK, 'User profile fetched successfully', responseUser);
	}

	@UseGuards(JwtAuthGuard)
	@Put('profile')
	async updateProfile(
		@Body() updateData: UpdateProfileDto,
		@Request() req: ExpressRequest,
	): Promise<ApiResponse<UserWithoutPasswordResponse>> {
		const userId = Number(req.user?.id);

		const validate = updateProfileSchema.safeParse(updateData);
		if (!validate.success) {
			throw new BadRequestException(
				`Validation failed: ${validate.error.issues.map(issue => issue.message).join(', ')}`,
			);
		}

		const updatedUser = await this.authService.updateUser(userId, validate.data);

		const responseUser: UserWithoutPasswordResponse = {
			...updatedUser,
			id: updatedUser.publicId,
			imageInformation: null,
		};

		return createApiResponse(HttpStatus.OK, 'Profile updated successfully', responseUser);
	}

	@UseGuards(JwtAuthGuard)
	@Put('profile/image')
	@UseInterceptors(
		FileInterceptor('avatar', {
			storage: memoryStorage(),
			// Multer-level hard limit (fast fail before Zod, still validate in Zod too)
			limits: { fileSize: FILE_SIZE_LIMIT },
		}),
	)
	async uploadMedia(
		@UploadedFile(new ZodFileValidationPipe(singleFileSchema))
		file: Express.Multer.File,
		@Req() request: ExpressRequest,
	): Promise<ApiResponse<UserWithoutPassword>> {
		const userId = Number(request.user?.id);
		const result = await this.cloudinaryImageService.uploadWithFaceDetection(file.buffer, {
			size: 200,
			gravity: 'face:auto',
		});

		if (!result.success || !result.data) {
			throw new BadRequestException('Failed to upload image');
		}

		const data: MediaDataType = {
			altText: null,
			secureUrl: result.data.secure_url,
			filename: file.originalname,
			mimeType: file.mimetype,
			fileExtension: file.originalname.split('.').pop() || '',
			fileSize: file.size,
			storageKey: result.data.public_id,
			mediaType: file.mimetype.startsWith('image/') ? 'image' : 'other',
			storageMetadata: result.data,
			uploadedBy: userId,
			caption: null,
			description: null,
			tags: result.data.tags || [],
			duration: result.data.duration || null,
			width: result.data.width || null,
			height: result.data.height || null,
		};

		// Delete previous image from Cloudinary if exists
		const currentUser = await this.authService.findUserById(userId);
		if (currentUser.imageInformation && currentUser.imageInformation.public_id) {
			await this.cloudinaryImageService.deleteMedia(currentUser.imageInformation.public_id);
		}

		const response = await this.authService.updateUser(userId, {
			image: data.secureUrl!,
			imageInformation: result.data,
		});

		return createApiResponse(HttpStatus.OK, 'Media uploaded successfully', response);
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

		const cookieConfig = AppHelpers.sameSiteCookieConfig(this.configService);

		request.res?.cookie('access-token', accessToken, {
			httpOnly: true,
			secure: cookieConfig.secure,
			sameSite: cookieConfig.sameSite,
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
			imageInformation: null,
		};

		// Redirect to custom URL or return JSON response
		if (redirectUrl) {
			response.redirect(redirectUrl);
		} else {
			response.json(createApiResponse(HttpStatus.OK, 'Google login successful', responseUser));
		}
	}

	@UseGuards(JwtAuthGuard)
	@Put('email-preferences')
	async updateEmailPreferences(
		@Body() body: { receiveTransactionEmails: boolean },
		@Request() req: ExpressRequest,
	): Promise<ApiResponse<UserWithoutPasswordResponse>> {
		const userId = Number(req.user?.id);

		const updatedUser = await this.authService.updateUser(userId, {
			receiveTransactionEmails: body.receiveTransactionEmails,
		});

		const responseUser: UserWithoutPasswordResponse = {
			...updatedUser,
			id: updatedUser.publicId,
			imageInformation: null,
		};

		return createApiResponse(HttpStatus.OK, 'Email preferences updated successfully', responseUser);
	}

	@Get('unsubscribe/:token')
	async unsubscribe(@Param('token') token: string): Promise<ApiResponse<{ message: string }>> {
		try {
			// Decode token (format: base64 encoded email)
			const email = Buffer.from(token, 'base64').toString('utf-8');

			if (!email || !email.includes('@')) {
				throw new BadRequestException('Invalid unsubscribe token');
			}

			// Find user by email
			const user = await this.authService.findUserByEmail(email);
			if (!user) {
				throw new BadRequestException('User not found');
			}

			// Update email preferences
			await this.authService.updateUser(user.id, {
				receiveTransactionEmails: false,
			});

			return createApiResponse(HttpStatus.OK, 'Successfully unsubscribed from transaction emails', {
				message: 'You have been unsubscribed from transaction emails',
			});
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException('Failed to unsubscribe');
		}
	}
}
