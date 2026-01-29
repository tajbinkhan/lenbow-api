import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

type MulterFile = Express.Multer.File;

export const FILE_SIZE_LIMIT = 2 * 1024 * 1024; // 2MB

export const singleFileSchema = z
	.custom<MulterFile>(v => v && typeof v === 'object', {
		message: 'File is required',
	})
	.superRefine((file, ctx) => {
		// Required fields check (optional but helpful)
		if (!file?.originalname) {
			ctx.addIssue({ code: 'custom', message: 'Invalid file' });
			return;
		}

		// Allowed mimetypes
		const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/png'] as const;
		if (!allowed.includes(file.mimetype as (typeof allowed)[number])) {
			ctx.addIssue({
				code: 'custom',
				message: `Unsupported file type: ${file.mimetype}`,
			});
		}

		// Max size: 2MB
		const maxBytes = FILE_SIZE_LIMIT;
		if (file.size > maxBytes) {
			ctx.addIssue({
				code: 'custom',
				message: `File too large. Max is ${maxBytes} bytes`,
			});
		}
	});

@Injectable()
export class ZodFileValidationPipe implements PipeTransform {
	constructor(private readonly schema: z.ZodTypeAny) {}

	transform(value: unknown) {
		const parsed = this.schema.safeParse(value);
		if (!parsed.success) {
			const msg = parsed.error.issues.map(i => i.message).join('; ');
			throw new BadRequestException(msg);
		}
		return parsed.data;
	}
}
