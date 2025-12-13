import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

import { EnvType } from 'src/core/env';

@Injectable()
export class CryptoService {
	private readonly algorithm = 'aes-256-gcm';
	private readonly keyLength = 32; // 256 bits
	private readonly ivLength = 16; // 128 bits
	private readonly authTagLength = 16; // 128 bits
	private readonly key: Buffer;

	constructor(private readonly configService: ConfigService<EnvType>) {
		const secret = this.configService.get('SECRET', { infer: true })!;
		// Derive a 256-bit key from the secret using scrypt
		this.key = scryptSync(secret, 'salt', this.keyLength);
	}

	/**
	 * Encrypts a plain text string using AES-256-GCM
	 * @param plainText - The text to encrypt
	 * @returns Base64 encoded string containing IV + AuthTag + CipherText
	 */
	encrypt(plainText: string): string {
		const iv = randomBytes(this.ivLength);
		const cipher = createCipheriv(this.algorithm, this.key, iv, {
			authTagLength: this.authTagLength,
		});

		const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
		const authTag = cipher.getAuthTag();

		// Combine IV + AuthTag + Encrypted data
		const combined = Buffer.concat([iv, authTag, encrypted]);

		return combined.toString('base64');
	}

	/**
	 * Decrypts an encrypted string using AES-256-GCM
	 * @param encryptedText - Base64 encoded string containing IV + AuthTag + CipherText
	 * @returns The decrypted plain text string
	 */
	decrypt(encryptedText: string): string {
		const combined = Buffer.from(encryptedText, 'base64');

		// Extract IV, AuthTag, and encrypted data
		const iv = combined.subarray(0, this.ivLength);
		const authTag = combined.subarray(this.ivLength, this.ivLength + this.authTagLength);
		const encrypted = combined.subarray(this.ivLength + this.authTagLength);

		const decipher = createDecipheriv(this.algorithm, this.key, iv, {
			authTagLength: this.authTagLength,
		});
		decipher.setAuthTag(authTag);

		const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

		return decrypted.toString('utf8');
	}
}
