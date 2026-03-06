import type { INodeProperties } from 'n8n-workflow';

export const calendarOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['calendar'],
			},
		},
		options: [
			{
				name: 'Get Calendars',
				value: 'getCalendars',
				description: 'List all calendars in iCloud',
				action: 'List all iCloud calendars',
			},
			{
				name: 'Get Events',
				value: 'getEvents',
				description: 'Retrieve calendar events within a date range',
				action: 'Get calendar events from iCloud',
			},
			{
				name: 'Create Event',
				value: 'createEvent',
				description: 'Create a new calendar event in iCloud',
				action: 'Create a calendar event in iCloud',
			},
			{
				name: 'Update Event',
				value: 'updateEvent',
				description: 'Update an existing calendar event',
				action: 'Update a calendar event in iCloud',
			},
			{
				name: 'Delete Event',
				value: 'deleteEvent',
				description: 'Delete a calendar event from iCloud',
				action: 'Delete a calendar event from iCloud',
			},
		],
		default: 'getEvents',
	},
];

export const calendarFields: INodeProperties[] = [
	// ─── Get Events ───────────────────────────────────────────────────────────────
	{
		displayName: 'Calendar URL',
		name: 'calendarUrl',
		type: 'string',
		displayOptions: {
			show: { resource: ['calendar'], operation: ['getEvents'] },
		},
		default: '',
		placeholder: 'https://p01-caldav.icloud.com/...',
		description:
			'URL of a specific calendar to fetch events from. Leave empty to fetch from all calendars. Use "Get Calendars" operation to obtain calendar URLs.',
	},
	{
		displayName: 'Start Date',
		name: 'start',
		type: 'dateTime',
		displayOptions: {
			show: { resource: ['calendar'], operation: ['getEvents'] },
		},
		default: '',
		description: 'Start of the date range to fetch events for',
	},
	{
		displayName: 'End Date',
		name: 'end',
		type: 'dateTime',
		displayOptions: {
			show: { resource: ['calendar'], operation: ['getEvents'] },
		},
		default: '',
		description: 'End of the date range to fetch events for',
	},

	// ─── Create Event ─────────────────────────────────────────────────────────────
	{
		displayName: 'Calendar URL',
		name: 'calendarUrl',
		type: 'string',
		required: true,
		displayOptions: {
			show: { resource: ['calendar'], operation: ['createEvent'] },
		},
		default: '',
		placeholder: 'https://p01-caldav.icloud.com/...',
		description:
			'URL of the calendar to create the event in. Use "Get Calendars" to get available calendar URLs.',
	},
	{
		displayName: 'Summary (Title)',
		name: 'summary',
		type: 'string',
		required: true,
		displayOptions: {
			show: { resource: ['calendar'], operation: ['createEvent'] },
		},
		default: '',
		placeholder: 'Meeting with team',
		description: 'Title/summary of the calendar event',
	},
	{
		displayName: 'Start',
		name: 'start',
		type: 'dateTime',
		required: true,
		displayOptions: {
			show: { resource: ['calendar'], operation: ['createEvent'] },
		},
		default: '',
		description: 'Start date and time of the event (ISO 8601 format)',
	},
	{
		displayName: 'End',
		name: 'end',
		type: 'dateTime',
		required: true,
		displayOptions: {
			show: { resource: ['calendar'], operation: ['createEvent'] },
		},
		default: '',
		description: 'End date and time of the event (ISO 8601 format)',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['calendar'], operation: ['createEvent'] },
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				typeOptions: { rows: 3 },
				description: 'Detailed description or notes for the event',
			},
			{
				displayName: 'Location',
				name: 'location',
				type: 'string',
				default: '',
				placeholder: 'Conference Room A',
				description: 'Location where the event takes place',
			},
			{
				displayName: 'All Day Event',
				name: 'allDay',
				type: 'boolean',
				default: false,
				description: 'Whether this is an all-day event (ignores time portion)',
			},
		],
	},

	// ─── Update Event ─────────────────────────────────────────────────────────────
	{
		displayName: 'Event URL',
		name: 'eventUrl',
		type: 'string',
		required: true,
		displayOptions: {
			show: { resource: ['calendar'], operation: ['updateEvent', 'deleteEvent'] },
		},
		default: '',
		placeholder: 'https://p01-caldav.icloud.com/.../uuid.ics',
		description:
			'Full URL of the event to update or delete. Returned by "Get Events" or "Create Event" operations.',
	},
	{
		displayName: 'Fields to Update',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['calendar'], operation: ['updateEvent'] },
		},
		options: [
			{
				displayName: 'Summary (Title)',
				name: 'summary',
				type: 'string',
				default: '',
				description: 'New title for the event',
			},
			{
				displayName: 'Start',
				name: 'start',
				type: 'dateTime',
				default: '',
				description: 'New start date/time for the event',
			},
			{
				displayName: 'End',
				name: 'end',
				type: 'dateTime',
				default: '',
				description: 'New end date/time for the event',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				typeOptions: { rows: 3 },
				description: 'New description for the event',
			},
			{
				displayName: 'Location',
				name: 'location',
				type: 'string',
				default: '',
				description: 'New location for the event',
			},
			{
				displayName: 'All Day Event',
				name: 'allDay',
				type: 'boolean',
				default: false,
				description: 'Whether to make this an all-day event',
			},
		],
	},
];
