import { ImapFlow } from 'imapflow';

export interface ImapCredentials {
	appleId: string;
	password: string;
	mailAddress?: string;
}

export interface EmailMessage {
	uid: number;
	messageId: string;
	from: string;
	to: string;
	cc?: string;
	subject: string;
	date: string;
	flags: string[];
	bodyText?: string;
	bodyHtml?: string;
	size?: number;
}

export interface GetEmailsOptions {
	mailbox?: string;
	limit?: number;
	filterFrom?: string;
	filterTo?: string;
	filterSubject?: string;
	onlyUnread?: boolean;
	since?: string;
	hasAttachments?: boolean;
}

function messageHasAttachment(structure: unknown): boolean {
	if (!structure || typeof structure !== 'object') return false;
	const s = structure as { disposition?: string; childNodes?: unknown[] };
	if (s.disposition === 'attachment') return true;
	return (s.childNodes ?? []).some(messageHasAttachment);
}

const ICLOUD_IMAP_HOST = 'imap.mail.me.com';
const ICLOUD_IMAP_PORT = 993;

function createImapClient(credentials: ImapCredentials): ImapFlow {
	return new ImapFlow({
		host: ICLOUD_IMAP_HOST,
		port: ICLOUD_IMAP_PORT,
		secure: true,
		auth: {
			user: credentials.mailAddress || credentials.appleId,
			pass: credentials.password,
		},
		logger: false,
	});
}

export async function getEmails(
	credentials: ImapCredentials,
	options: GetEmailsOptions = {},
): Promise<EmailMessage[]> {
	const {
		mailbox = 'INBOX',
		limit = 10,
		filterFrom,
		filterTo,
		filterSubject,
		onlyUnread = false,
		since,
		hasAttachments = false,
	} = options;

	const client = createImapClient(credentials);
	try {
		await client.connect();
	} catch (error) {
		throw new Error(
			`iCloud IMAP authentication failed: ${(error as Error).message}. Use an app-specific password (https://appleid.apple.com) and your full iCloud email (e.g. name@icloud.com).`,
		);
	}
	try {
		await client.mailboxOpen(mailbox);

		// Build search criteria
		const searchCriteria: Record<string, unknown> = {};
		if (onlyUnread) {
			searchCriteria['seen'] = false;
		}
		if (filterFrom) {
			searchCriteria['from'] = filterFrom;
		}
		if (filterTo) {
			searchCriteria['to'] = filterTo;
		}
		if (filterSubject) {
			searchCriteria['subject'] = filterSubject;
		}
		if (since) {
			searchCriteria['since'] = new Date(since);
		}

		const hasFilters = Object.keys(searchCriteria).length > 0;
		const uidResult = hasFilters
			? await client.search(searchCriteria, { uid: true })
			: await client.search({ all: true }, { uid: true });

		// search() can return false when nothing is found
		const uids: number[] = Array.isArray(uidResult) ? uidResult : [];

		// Take last N (newest first)
		const selectedUids = uids.slice(-limit).reverse();

		const messages: EmailMessage[] = [];
		const rawStructures: unknown[] = [];

		// imapflow fetch expects number[] or a SequenceString like "1:*"
		const fetchTarget: number[] | string = selectedUids.length > 0 ? selectedUids : '1:*';

		for await (const message of client.fetch(
			fetchTarget,
			{
				uid: true,
				flags: true,
				envelope: true,
				bodyStructure: true,
				size: true,
			},
			{ uid: true },
		)) {
			if (messages.length >= limit) break;

			const envelope = message.envelope;
			messages.push({
				uid: message.uid,
				messageId: envelope?.messageId ?? '',
				from: envelope?.from?.[0]?.address ?? '',
				to: envelope?.to?.map((a) => a.address).join(', ') ?? '',
				cc: envelope?.cc?.map((a) => a.address).join(', ') ?? undefined,
				subject: envelope?.subject ?? '(no subject)',
				date: envelope?.date?.toISOString() ?? '',
				flags: [...(message.flags ?? [])],
				size: message.size,
			});
			rawStructures.push(message.bodyStructure);
		}

		if (hasAttachments) {
			return messages.filter((_, idx) => messageHasAttachment(rawStructures[idx]));
		}

		return messages;
	} catch (error) {
		throw new Error(
			`iCloud IMAP error: ${(error as Error).message}. Check the mailbox name — common iCloud names: INBOX, "Sent Messages", Drafts, "Deleted Messages", Junk.`,
		);
	} finally {
		if (client.authenticated) await client.logout().catch(() => {});
	}
}

export async function getEmailById(
	credentials: ImapCredentials,
	uid: number,
	mailbox = 'INBOX',
): Promise<EmailMessage | null> {
	const client = createImapClient(credentials);
	try {
		await client.connect();
	} catch (error) {
		throw new Error(
			`iCloud IMAP authentication failed: ${(error as Error).message}. Use an app-specific password and your full iCloud email (e.g. name@icloud.com).`,
		);
	}
	try {
		await client.mailboxOpen(mailbox);

		let found: EmailMessage | null = null;

		for await (const message of client.fetch(
			String(uid),
			{
				uid: true,
				flags: true,
				envelope: true,
				bodyStructure: true,
				source: true,
			},
			{ uid: true },
		)) {
			const envelope = message.envelope;

			// Get body text from source
			const sourceBuffer = message.source;
			const sourceText = sourceBuffer ? sourceBuffer.toString('utf-8') : '';

			// Simple body extraction (after headers)
			const headerEnd = sourceText.indexOf('\r\n\r\n');
			const body = headerEnd !== -1 ? sourceText.slice(headerEnd + 4) : sourceText;

			found = {
				uid: message.uid,
				messageId: envelope?.messageId ?? '',
				from: envelope?.from?.[0]?.address ?? '',
				to: envelope?.to?.map((a) => a.address).join(', ') ?? '',
				cc: envelope?.cc?.map((a) => a.address).join(', ') ?? undefined,
				subject: envelope?.subject ?? '(no subject)',
				date: envelope?.date?.toISOString() ?? '',
				flags: [...(message.flags ?? [])],
				bodyText: body,
			};
			break;
		}

		return found;
	} catch (error) {
		throw new Error(
			`iCloud IMAP error: ${(error as Error).message}. Check the mailbox name — common iCloud names: INBOX, "Sent Messages", Drafts, "Deleted Messages", Junk.`,
		);
	} finally {
		if (client.authenticated) await client.logout().catch(() => {});
	}
}

export async function moveEmail(
	credentials: ImapCredentials,
	uid: number,
	fromMailbox: string,
	toMailbox: string,
): Promise<void> {
	const client = createImapClient(credentials);
	try {
		await client.connect();
	} catch (error) {
		throw new Error(`iCloud IMAP authentication failed: ${(error as Error).message}.`);
	}
	try {
		await client.mailboxOpen(fromMailbox);
		await client.messageMove(String(uid), toMailbox, { uid: true });
	} catch (error) {
		throw new Error(`iCloud IMAP error: ${(error as Error).message}. Check mailbox names.`);
	} finally {
		if (client.authenticated) await client.logout().catch(() => {});
	}
}

export async function deleteEmail(
	credentials: ImapCredentials,
	uid: number,
	mailbox = 'INBOX',
): Promise<void> {
	const client = createImapClient(credentials);
	try {
		await client.connect();
	} catch (error) {
		throw new Error(`iCloud IMAP authentication failed: ${(error as Error).message}.`);
	}
	try {
		await client.mailboxOpen(mailbox);
		await client.messageDelete(String(uid), { uid: true });
	} catch (error) {
		throw new Error(`iCloud IMAP error: ${(error as Error).message}. Check the mailbox name.`);
	} finally {
		if (client.authenticated) await client.logout().catch(() => {});
	}
}

export async function listMailboxes(credentials: ImapCredentials): Promise<string[]> {
	const client = createImapClient(credentials);
	try {
		await client.connect();
		const mailboxes = await client.list();
		return mailboxes.map((m) => m.path);
	} catch (error) {
		throw new Error(`IMAP connection failed: ${(error as Error).message}`);
	} finally {
		if (client.authenticated) await client.logout().catch(() => {});
	}
}
