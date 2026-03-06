import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SmtpCredentials {
	appleId: string;
	password: string;
}

export interface SendMailOptions {
	to: string;
	cc?: string;
	bcc?: string;
	subject: string;
	text?: string;
	html?: string;
	attachments?: Array<{
		filename: string;
		content: string | Buffer;
		encoding?: string;
		contentType?: string;
	}>;
}

export interface SendMailResult {
	messageId: string;
	accepted: string[];
	rejected: string[];
}

const ICLOUD_SMTP_HOST = 'smtp.mail.me.com';
const ICLOUD_SMTP_PORT = 587;

export function createSmtpTransporter(credentials: SmtpCredentials): Transporter {
	return nodemailer.createTransport({
		host: ICLOUD_SMTP_HOST,
		port: ICLOUD_SMTP_PORT,
		secure: false, // STARTTLS
		requireTLS: true,
		auth: {
			user: credentials.appleId,
			pass: credentials.password,
		},
		tls: {
			minVersion: 'TLSv1.2',
		},
	});
}

export async function sendMail(
	credentials: SmtpCredentials,
	options: SendMailOptions,
): Promise<SendMailResult> {
	const transporter = createSmtpTransporter(credentials);

	try {
		const info = await transporter.sendMail({
			from: credentials.appleId,
			to: options.to,
			cc: options.cc,
			bcc: options.bcc,
			subject: options.subject,
			text: options.text,
			html: options.html,
			attachments: options.attachments,
		});

		return {
			messageId: info.messageId,
			accepted: info.accepted as string[],
			rejected: info.rejected as string[],
		};
	} finally {
		transporter.close();
	}
}
