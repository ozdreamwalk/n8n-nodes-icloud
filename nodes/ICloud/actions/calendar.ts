import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
	getCalendars,
	getEvents,
	createEvent,
	updateEvent,
	deleteEvent,
} from '../helpers/dav.helper';
import type { CreateEventOptions, DavCredentials } from '../helpers/dav.helper';

type WritableEventFields = Partial<Omit<CreateEventOptions, 'calendarUrl' | 'summary' | 'start' | 'end'>>;

const jsonEventFields = [
	'organizer', 'attendees', 'recurrenceRules', 'recurrenceDates', 'excludedDates', 'alarms',
	'attachments', 'categories', 'geo', 'comments', 'contacts', 'resources', 'relatedTo',
	'requestStatus', 'customProperties', 'customComponents',
] as const;

function normalizeEventFields(value: Record<string, unknown>): WritableEventFields {
	const normalized = { ...value };
	if (normalized.timezone === '') delete normalized.timezone;
	for (const name of jsonEventFields) {
		if (typeof normalized[name] === 'string') {
			const raw = normalized[name] as string;
			normalized[name] = raw.trim() ? JSON.parse(raw) as unknown : undefined;
		}
	}
	return normalized as WritableEventFields;
}

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
			// Strip internal `url` field — expose calendarId, displayName, description, color
			const output = calendars.map(({ url: _url, ...rest }) => rest);
			return this.helpers.returnJsonArray(output as unknown as IDataObject[]);
		}

		case 'getEvents': {
			const calendarUrl = this.getNodeParameter('calendarUrl', i, '') as string;
			const start = this.getNodeParameter('start', i, '') as string;
			const end = this.getNodeParameter('end', i, '') as string;
			const includeRawData = this.getNodeParameter('includeRawData', i, false) as boolean;

			const events = await getEvents(
				creds,
				calendarUrl || undefined,
				start || undefined,
				end || undefined,
				includeRawData,
			);

			return this.helpers.returnJsonArray(events as unknown as IDataObject[]);
		}

		case 'createEvent': {
			const calendarUrl = this.getNodeParameter('calendarUrl', i) as string;
			const summary = this.getNodeParameter('summary', i) as string;
			const start = this.getNodeParameter('start', i) as string;
			const end = this.getNodeParameter('end', i) as string;
			const additionalFields = normalizeEventFields(
				this.getNodeParameter('additionalFields', i, {}) as Record<string, unknown>,
			);

			const result = await createEvent(creds, {
				...additionalFields,
				calendarUrl,
				summary,
				start,
				end,
				timezone: additionalFields.timezone || undefined,
			});

			return this.helpers.returnJsonArray([
				{
					success: true,
					uid: result.uid,
					url: result.url,
					etag: result.etag,
					summary,
					start,
					end,
				},
			]);
		}

		case 'updateEvent': {
			const calendarUrl = this.getNodeParameter('calendarUrl', i) as string;
			const uid = this.getNodeParameter('uid', i) as string;
			const updateFields = normalizeEventFields(
				this.getNodeParameter('updateFields', i, {}) as Record<string, unknown>,
			) as Partial<Omit<CreateEventOptions, 'calendarUrl'>>;

			if (Object.keys(updateFields).length === 0) {
				throw new NodeOperationError(
					this.getNode(),
					'Please specify at least one field to update',
					{ itemIndex: i },
				);
			}

			await updateEvent(creds, calendarUrl, uid, updateFields);

			return this.helpers.returnJsonArray([
				{
					success: true,
					uid,
					updated: updateFields,
				},
			]);
		}

		case 'deleteEvent': {
			const calendarUrl = this.getNodeParameter('calendarUrl', i) as string;
			const uid = this.getNodeParameter('uid', i) as string;

			await deleteEvent(creds, calendarUrl, uid);

			return this.helpers.returnJsonArray([
				{
					success: true,
					uid,
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
