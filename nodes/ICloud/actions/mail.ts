import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sendMail } from '../helpers/smtp.helper';
import {
	getEmails,
	getEmailById,
	moveEmail,
	deleteEmail,
} from '../helpers/imap.helper';
import type { ImapCredentials } from '../helpers/imap.helper';

export async function handleMailOperation(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	const credentials = await this.getCredentials('iCloudCredentials') as {
		appleId: string;
		password: string;
		mailAddress?: string;
	};

	const creds: ImapCredentials = {
		appleId: credentials.appleId,
		password: credentials.password,
		mailAddress: credentials.mailAddress || undefined,
	};

	switch (operation) {
		case 'sendEmail': {
			const to = this.getNodeParameter('to', i) as string;
			const subject = this.getNodeParameter('subject', i) as string;
			const body = this.getNodeParameter('body', i) as string;
			const additionalFields = this.getNodeParameter('additionalFields', i) as {
				cc?: string;
				bcc?: string;
				isHtml?: boolean;
			};

			// Resolve binary attachments
			const attachmentsInput = this.getNodeParameter('attachments', i, { attachment: [] }) as {
				attachment?: Array<{ binaryPropertyName: string; fileName?: string }>;
			};
			const resolvedAttachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
			for (const att of (attachmentsInput.attachment ?? [])) {
				const binaryData = this.helpers.assertBinaryData(i, att.binaryPropertyName);
				const buffer = await this.helpers.getBinaryDataBuffer(i, att.binaryPropertyName);
				resolvedAttachments.push({
					filename: att.fileName || binaryData.fileName || att.binaryPropertyName,
					content: buffer,
					contentType: binaryData.mimeType,
				});
			}

			const smtpCreds = { appleId: credentials.appleId, password: credentials.password, mailAddress: credentials.mailAddress || undefined };
			const result = await sendMail(smtpCreds, {
				to,
				subject,
				cc: additionalFields.cc,
				bcc: additionalFields.bcc,
				text: additionalFields.isHtml ? undefined : body,
				html: additionalFields.isHtml ? body : undefined,
				attachments: resolvedAttachments.length ? resolvedAttachments : undefined,
			});

			return this.helpers.returnJsonArray([result as unknown as IDataObject]);
		}

		case 'getEmails': {
			const mailbox = this.getNodeParameter('mailbox', i, 'INBOX') as string;
			const limit = this.getNodeParameter('limit', i, 10) as number;
			const filters = this.getNodeParameter('filters', i, {}) as {
				filterFrom?: string;
				filterSubject?: string;
				onlyUnread?: boolean;
				since?: string;
			};

			const emails = await getEmails(creds, {
				mailbox,
				limit,
				filterFrom: filters.filterFrom,
				filterSubject: filters.filterSubject,
				onlyUnread: filters.onlyUnread,
				since: filters.since,
			});

			return this.helpers.returnJsonArray(emails as unknown as IDataObject[]);
		}

		case 'getEmailById': {
			const uid = this.getNodeParameter('uid', i) as number;
			const mailbox = this.getNodeParameter('mailbox', i, 'INBOX') as string;

			const email = await getEmailById(creds, uid, mailbox);

			if (!email) {
				throw new NodeOperationError(
					this.getNode(),
					`Email with UID ${uid} not found in ${mailbox}`,
					{ itemIndex: i },
				);
			}

			return this.helpers.returnJsonArray([email as unknown as IDataObject]);
		}

		case 'moveEmail': {
			const uid = this.getNodeParameter('uid', i) as number;
			const fromMailbox = this.getNodeParameter('fromMailbox', i) as string;
			const toMailbox = this.getNodeParameter('toMailbox', i) as string;

			await moveEmail(creds, uid, fromMailbox, toMailbox);

			return this.helpers.returnJsonArray([
				{
					success: true,
					uid,
					movedFrom: fromMailbox,
					movedTo: toMailbox,
				},
			]);
		}

		case 'deleteEmail': {
			const uid = this.getNodeParameter('uid', i) as number;
			const mailbox = this.getNodeParameter('mailbox', i, 'INBOX') as string;

			await deleteEmail(creds, uid, mailbox);

			return this.helpers.returnJsonArray([
				{
					success: true,
					uid,
					mailbox,
					deleted: true,
				},
			]);
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown Mail operation: ${operation}`, {
				itemIndex: i,
			});
	}
}
