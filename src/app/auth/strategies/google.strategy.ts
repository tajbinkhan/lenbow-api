import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import type { EnvType } from '../../../core/env';

export interface GoogleProfile {
	email: string;
	name: string;
	picture: string;
	googleId: string;
	accessToken?: string;
	refreshToken?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
	constructor(private readonly configService: ConfigService<EnvType, true>) {
		super({
			clientID: configService.get('GOOGLE_CLIENT_ID', { infer: true }),
			clientSecret: configService.get('GOOGLE_CLIENT_SECRET', { infer: true }),
			callbackURL: configService.get('GOOGLE_CALLBACK_URL', { infer: true }),
			scope: ['email', 'profile'],
		});
	}

	// 👇 Adds query params to Google authorization URL
	authorizationParams(): Record<string, string> {
		return {
			prompt: 'select_account', // show account chooser
			// optionally:
			// access_type: 'offline', // if you want refresh tokens (usually with prompt: 'consent')
			// include_granted_scopes: 'true',
		};
	}

	validate(accessToken: string, refreshToken: string, profile: Profile): GoogleProfile {
		const { id, emails, photos, displayName } = profile;

		const user: GoogleProfile = {
			email: emails?.[0]?.value ?? '',
			name: displayName,
			picture: photos?.[0]?.value ?? '',
			googleId: id,
			accessToken,
			refreshToken,
		};

		return user;
	}
}
