import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
	getCalendars,
	getEvents,
	createEvent,
	updateEvent,
	deleteEvent,
} from '../helpers/dav.helper';
import type { DavCredentials } from '../helpers/dav.helper';

export async function handleCalendarOperation(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	const credentials = await this.getCredentials('iCloudCredentials') as {
		appleId: string;
		password: string;
	};

	const creds: DavCredentials = {
		appleId: credentials.appleId,
		password: credentials.password,
	};

	switch (operation) {
		case 'getCalendars': {
			const calendars = await getCalendars(creds);
			const output = calendars.map(({ url: _url, ...rest }) => rest);
			return this.helpers.returnJsonArray(output as unknown as IDataObject[]);
		}

		case 'getEvents': {
			const calendarUrl = this.getNodeParameter('calendarUrl', i, '') as string;
			const start = this.getNodeParameter('start', i, '') as string;
			const end = this.getNodeParameter('end', i, '') as string;

			const events = await getEvents(
				creds,
				calendarUrl || undefined,
				start || undefined,
				end || undefined,
			);

			return this.helpers.returnJsonArray(events as unknown as IDataObject[]);
		}

		case 'createEvent': {
			const calendarUrl = this.getNodeParameter('calendarUrl', i) as string;
			const summary = this.getNodeParameter('summary', i) as string;
			const start = this.getNodeParameter('start', i) as string;
			const end = this.getNodeParameter('end', i) as string;
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as {
				description?: string;
				location?: string;
				allDay?: boolean;
				timezone?: string;
			};

			const result = await createEvent(creds, {
				calendarUrl,
				summary,
				start,
				end,
				description: additionalFields.description,
				location: additionalFields.location,
				allDay: additionalFields.allDay,
				timezone: additionalFields.timezone || undefined,
			});

			return this.helpers.returnJsonArray([
				{
					success: true,
					etag: result.etag,
					summary,
					start,
					end,
				},
			]);
		}

		case 'updateEvent': {
			const eventUrl = this.getNodeParameter('eventUrl', i) as string;
			const updateFields = this.getNodeParameter('updateFields', i, {}) as {
				summary?: string;
				start?: string;
				end?: string;
				description?: string;
				location?: string;
				allDay?: boolean;
				timezone?: string;
			};

			if (Object.keys(updateFields).length === 0) {
				throw new NodeOperationError(
					this.getNode(),
					'Please specify at least one field to update',
					{ itemIndex: i },
				);
			}

			await updateEvent(creds, eventUrl, updateFields);

			return this.helpers.returnJsonArray([
				{
					success: true,
					updated: updateFields,
				},
			]);
		}

		case 'deleteEvent': {
			const eventUrl = this.getNodeParameter('eventUrl', i) as string;

			await deleteEvent(creds, eventUrl);

			return this.helpers.returnJsonArray([
				{
					success: true,
					deleted: true,
				},
			]);
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown Calendar operation: ${operation}`, {
				itemIndex: i,
			});
	}
}
