import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CsrfService } from './csrf.service';

@Controller('csrf')
export class CsrfController {
	constructor(private readonly csrfService: CsrfService) {}

	@Get('')
	getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const token = this.csrfService.generateCsrfToken(req, res);
		return token;
	}
}
