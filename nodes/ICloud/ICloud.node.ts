import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { mailOperations, mailFields } from './descriptions/mail.description';
import { calendarOperations, calendarFields } from './descriptions/calendar.description';
import { contactsOperations, contactsFields } from './descriptions/contacts.description';
import { handleMailOperation } from './actions/mail';
import { handleCalendarOperation } from './actions/calendar';
import { handleContactsOperation } from './actions/contacts';
import { getCalendars } from './helpers/dav.helper';
import { listMailboxes } from './helpers/imap.helper';

export class ICloud implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'iCloud',
		name: 'iCloud',
		icon: 'file:icloud.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Apple iCloud — Mail, Calendar, and Contacts',
		defaults: {
			name: 'iCloud',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'iCloudCredentials',
				required: true,
			},
		],
		properties: [
			// ─── Version Notice ────────────────────────────────────────────────────────
			{
				displayName: 'iCloud Node v2.0.8',
				name: 'versionNotice',
				type: 'notice',
				default: '',
			},

			// ─── Resource Selector ─────────────────────────────────────────────────────
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Mail',
						value: 'mail',
						description: 'Send and receive iCloud emails via SMTP/IMAP',
					},
					{
						name: 'Calendar',
						value: 'calendar',
						description: 'Manage iCloud calendar events via CalDAV',
					},
					{
						name: 'Contacts',
						value: 'contacts',
						description: 'Manage iCloud contacts via CardDAV',
					},
				],
				default: 'mail',
			},

			// ─── Operations per Resource ───────────────────────────────────────────────
			...mailOperations,
			...calendarOperations,
			...contactsOperations,

			// ─── Fields per Operation ──────────────────────────────────────────────────
			...mailFields,
			...calendarFields,
			...contactsFields,
		],
	};

	methods = {
		loadOptions: {
			async getCalendarOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('iCloudCredentials') as {
					appleId: string;
					password: string;
				};
				const calendars = await getCalendars({ appleId: credentials.appleId, password: credentials.password });
				return calendars.map((cal) => ({
					name: cal.displayName,
					value: cal.url,
				}));
			},

			async getCalendarOptionsWithAll(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('iCloudCredentials') as {
					appleId: string;
					password: string;
				};
				const calendars = await getCalendars({ appleId: credentials.appleId, password: credentials.password });
				return [
					{ name: 'All Calendars', value: '' },
					...calendars.map((cal) => ({ name: cal.displayName, value: cal.url })),
				];
			},

			async getTimezones(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const tzList: string[] = (Intl as any).supportedValuesOf?.('timeZone') ?? [];
				return tzList.map((tz) => ({ name: tz, value: tz }));
			},

			async getMailboxOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// Default iCloud mailbox names — used as fallback when IMAP connection fails
				// (iCloud IMAP requires @icloud.com address; CalDAV may use a different Apple ID)
				const defaultMailboxes: INodePropertyOptions[] = [
					{ name: 'INBOX', value: 'INBOX' },
					{ name: 'Sent Messages', value: 'Sent Messages' },
					{ name: 'Drafts', value: 'Drafts' },
					{ name: 'Deleted Messages', value: 'Deleted Messages' },
					{ name: 'Junk', value: 'Junk' },
					{ name: 'Archive', value: 'Archive' },
				];
				try {
					const credentials = await this.getCredentials('iCloudCredentials') as {
						appleId: string;
						password: string;
					};
					const mailboxes = await listMailboxes({ appleId: credentials.appleId, password: credentials.password });
					return mailboxes.map((m) => ({ name: m, value: m }));
				} catch {
					// IMAP credentials may differ from CalDAV — return standard iCloud mailboxes
					return defaultMailboxes;
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				let results: INodeExecutionData[];

				switch (resource) {
					case 'mail':
						results = await handleMailOperation.call(this, operation, i);
						break;

					case 'calendar':
						results = await handleCalendarOperation.call(this, operation, i);
						break;

					case 'contacts':
						results = await handleContactsOperation.call(this, operation, i);
						break;

					default:
						throw new NodeOperationError(
							this.getNode(),
							`Unknown resource: ${resource}`,
							{ itemIndex: i },
						);
				}

				returnData.push(...results);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: { item: i },
					});
					continue;
				}

				if (error instanceof NodeOperationError) {
					throw error;
				}

				throw new NodeOperationError(
					this.getNode(),
					error instanceof Error ? error : new Error(String(error)),
					{ itemIndex: i },
				);
			}
		}

		return [returnData];
	}
}
