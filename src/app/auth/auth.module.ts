import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthSession } from 'src/app/auth/auth.session';
import { GoogleStrategy } from 'src/app/auth/strategies/google.strategy';
import { JwtStrategy } from 'src/app/auth/strategies/jwt.strategy';
import { sessionTimeout } from 'src/core/constants';
import type { EnvType } from 'src/core/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
	imports: [
		PassportModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService<EnvType>) => ({
				secret: configService.get('SECRET', { infer: true }),
				signOptions: { expiresIn: sessionTimeout / 1000 }, // Convert ms to seconds
			}),
		}),
	],
	providers: [AuthService, JwtStrategy, GoogleStrategy, AuthSession],
	controllers: [AuthController],
	exports: [AuthService],
})
export class AuthModule {}
