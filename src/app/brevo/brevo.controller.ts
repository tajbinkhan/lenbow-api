import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvType } from '../../core/env';
import { BrevoService } from './brevo.service';

@Controller('brevo')
export class BrevoController {
	constructor(
		private readonly brevoService: BrevoService,
		private configService: ConfigService<EnvType, true>,
	) {}

	@Get('')
	async sendTestEmail() {
		await this.brevoService.sendFromTemplate({
			templateKey: 'request_send',
			to: [{ email: 'tajbink@gmail.com', name: 'Test User' }],
			params: {
				borrowerName: 'User',
				lenderName: 'User',
				amount: 100,
				requestDate: new Date().toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'long',
					day: 'numeric',
					hour12: true,
					hour: '2-digit',
					minute: '2-digit',
				}),
				dueDate: new Date().toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'long',
					day: 'numeric',
					hour12: true,
					hour: '2-digit',
					minute: '2-digit',
				}),
				description: '',
				transactionId: 'test-transaction-id',
				actionUrl: `${this.configService.get('APP_URL')}/requests?search=test-transaction-id`,
				supportEmail: 'support@example.com',
				year: new Date().getFullYear(),
			},
		});
	}
}
