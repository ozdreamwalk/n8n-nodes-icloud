import type {
	IExecuteFunctions,
	INodeExecutionData,
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
