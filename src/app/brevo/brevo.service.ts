import { Brevo, BrevoClient } from '@getbrevo/brevo';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvType } from '../../core/env';
import { TemplateService } from '../template/template.service';

@Injectable()
export class BrevoService {
	private client: BrevoClient;

	constructor(
		private readonly templates: TemplateService,
		private configService: ConfigService<EnvType, true>,
	) {
		this.client = new BrevoClient({
			apiKey: this.configService.get('BREVO_API_KEY', { infer: true }),
		});
	}

	async sendEmail(params: {
		to: { email: string; name?: string }[];
		subject: string;
		htmlContent?: string;
		textContent?: string;
		replyTo?: { email: string; name?: string };
	}) {
		const request: Brevo.SendTransacEmailRequest = {
			to: params.to,
			subject: params.subject,
			sender: {
				email: this.configService.get('BREVO_SENDER_EMAIL', { infer: true }),
				name: this.configService.get('BREVO_SENDER_NAME', { infer: true }),
			},
			htmlContent: params.htmlContent,
			textContent: params.textContent,
			replyTo: params.replyTo,
		};

		return this.client.transactionalEmails.sendTransacEmail(request);
	}

	async sendTemplateEmail(params: {
		to: { email: string; name?: string }[];
		templateId: number;
		params?: Record<string, any>; // template variables
		subject?: string; // optional (template may already define it)
	}) {
		const request: Brevo.SendTransacEmailRequest = {
			to: params.to,
			templateId: params.templateId,
			sender: {
				email: this.configService.get('BREVO_SENDER_EMAIL', { infer: true }),
				name: this.configService.get('BREVO_SENDER_NAME', { infer: true }),
			},
			params: params.params,
			subject: params.subject,
		};

		return this.client.transactionalEmails.sendTransacEmail(request);
	}

	async sendFromTemplate(opts: {
		templateKey: string;
		to: { email: string; name?: string }[];
		params: Record<string, any>;
		replyTo?: { email: string; name?: string };
	}) {
		const rendered = await this.templates.render(opts.templateKey, opts.params);

		const request: Brevo.SendTransacEmailRequest = {
			to: opts.to,
			subject: rendered.subject,
			htmlContent: rendered.html,
			textContent: rendered.text,
			sender: {
				email: this.configService.get('BREVO_SENDER_EMAIL', { infer: true }),
				name: this.configService.get('BREVO_SENDER_NAME', { infer: true }),
			},
			replyTo: opts.replyTo,
			headers: { 'X-Template-Version': String(rendered.version) },
		};

		return this.client.transactionalEmails.sendTransacEmail(request);
	}
}
