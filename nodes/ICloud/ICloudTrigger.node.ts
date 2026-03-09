import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';

import { getEmails } from './helpers/imap.helper';
import type { ImapCredentials } from './helpers/imap.helper';

export class ICloudTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'iCloud Trigger',
		name: 'iCloudTrigger',
		icon: 'file:icloud.svg',
		group: ['trigger'],
		version: 1,
		description: 'Triggers when new emails arrive in your iCloud mailbox (polls IMAP)',
		defaults: {
			name: 'iCloud Trigger',
		},
		polling: true,
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'iCloudCredentials',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Mailbox',
				name: 'mailbox',
				type: 'string',
				default: 'INBOX',
				description:
					'Mailbox to watch for new emails. Common iCloud names: INBOX, "Sent Messages", Drafts, "Deleted Messages", Junk.',
			},
			{
				displayName: 'Initial Lookback (Hours)',
				name: 'initialLookbackHours',
				type: 'number',
				default: 0,
				description:
					'On first activation, return emails from the last N hours. 0 = silent start (no old emails returned, just initialize state).',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				options: [
					{
						displayName: 'From',
						name: 'filterFrom',
						type: 'string',
						default: '',
						description: 'Only trigger for emails from this sender address or name',
					},
					{
						displayName: 'Has Attachments',
						name: 'hasAttachments',
						type: 'boolean',
						default: false,
						description: 'Whether to trigger only for emails that have at least one attachment',
					},
					{
						displayName: 'Only Unread',
						name: 'onlyUnread',
						type: 'boolean',
						default: false,
						description: 'Whether to trigger only for emails not yet read in any mail client',
					},
					{
						displayName: 'Subject Contains',
						name: 'filterSubject',
						type: 'string',
						default: '',
						description: 'Only trigger when the subject contains this text',
					},
					{
						displayName: 'To Address Contains',
						name: 'filterTo',
						type: 'string',
						default: '',
						description: 'Only trigger for emails addressed to this recipient',
					},
				],
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const credentials = (await this.getCredentials('iCloudCredentials')) as {
			appleId: string;
			password: string;
			mailAddress?: string;
		};

		const creds: ImapCredentials = {
			appleId: credentials.appleId,
			password: credentials.password,
			mailAddress: credentials.mailAddress || undefined,
		};

		const mailbox = this.getNodeParameter('mailbox', 'INBOX') as string;
		const initialLookbackHours = this.getNodeParameter('initialLookbackHours', 0) as number;
		const filters = this.getNodeParameter('filters', {}) as {
			filterFrom?: string;
			filterTo?: string;
			filterSubject?: string;
			onlyUnread?: boolean;
			hasAttachments?: boolean;
		};

		const staticData = this.getWorkflowStaticData('node');
		const lastUid = staticData.lastUid as number | undefined;

		// Fetch recent emails (newest 100 — covers normal polling intervals)
		const emails = await getEmails(creds, {
			mailbox,
			limit: 100,
			filterFrom: filters.filterFrom,
			filterTo: filters.filterTo,
			filterSubject: filters.filterSubject,
			onlyUnread: filters.onlyUnread,
			hasAttachments: filters.hasAttachments,
		});

		if (!emails.length) {
			// Nothing in mailbox yet — initialize state and stop
			staticData.lastUid = 0;
			return null;
		}

		const maxUid = Math.max(...emails.map((e) => e.uid));

		if (lastUid === undefined) {
			// First activation: initialize state
			staticData.lastUid = maxUid;

			if (this.getMode() === 'manual') {
				// Test run: return the most recent email so user can see the data shape
				const sample = emails[0];
				return [this.helpers.returnJsonArray([sample as unknown as IDataObject])];
			}

			// Lookback: return emails from the last N hours on first activation
			if (initialLookbackHours > 0) {
				const since = new Date(Date.now() - initialLookbackHours * 3600 * 1000).toISOString();
				const lookbackEmails = emails.filter((e) => e.date >= since);
				if (lookbackEmails.length) {
					return [this.helpers.returnJsonArray(lookbackEmails as unknown as IDataObject[])];
				}
			}

			return null;
		}

		// Subsequent polls: return only emails newer than the last seen UID
		const newEmails = emails.filter((e) => e.uid > lastUid);

		// Always advance the pointer, even if filtered emails produced no results
		staticData.lastUid = maxUid;

		if (!newEmails.length) return null;

		return [this.helpers.returnJsonArray(newEmails as unknown as IDataObject[])];
	}
}
