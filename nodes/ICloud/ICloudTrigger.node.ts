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
						displayName: 'Subject Contains',
						name: 'filterSubject',
						type: 'string',
						default: '',
						description: 'Only trigger when the subject contains this text',
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
		const filters = this.getNodeParameter('filters', {}) as {
			filterFrom?: string;
			filterSubject?: string;
		};

		const staticData = this.getWorkflowStaticData('node');
		const lastUid = staticData.lastUid as number | undefined;

		// Fetch recent emails (newest 100 — covers normal polling intervals)
		const emails = await getEmails(creds, {
			mailbox,
			limit: 100,
			filterFrom: filters.filterFrom,
			filterSubject: filters.filterSubject,
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
