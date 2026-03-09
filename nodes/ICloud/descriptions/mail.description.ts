import type { INodeProperties } from 'n8n-workflow';

export const mailOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['mail'],
			},
		},
		options: [
			{
				name: 'Send Email',
				value: 'sendEmail',
				description: 'Send an email via iCloud Mail (SMTP)',
				action: 'Send an email via iCloud Mail',
			},
			{
				name: 'Get Emails',
				value: 'getEmails',
				description: 'Retrieve emails from an iCloud mailbox (IMAP)',
				action: 'Get emails from iCloud Mail',
			},
			{
				name: 'Get Email by ID',
				value: 'getEmailById',
				description: 'Retrieve a single email by its UID',
				action: 'Get a single email by UID',
			},
			{
				name: 'Move Email',
				value: 'moveEmail',
				description: 'Move an email to a different mailbox',
				action: 'Move an email to another mailbox',
			},
			{
				name: 'Delete Email',
				value: 'deleteEmail',
				description: 'Permanently delete an email',
				action: 'Delete an email',
			},
		],
		default: 'getEmails',
	},
];

export const mailFields: INodeProperties[] = [
	// ─── Send Email ───────────────────────────────────────────────────────────────
	{
		displayName: 'To',
		name: 'to',
		type: 'string',
		required: true,
		displayOptions: {
			show: { resource: ['mail'], operation: ['sendEmail'] },
		},
		default: '',
		placeholder: 'recipient@example.com',
		description: 'Recipient email address. Multiple addresses separated by commas.',
	},
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		required: true,
		displayOptions: {
			show: { resource: ['mail'], operation: ['sendEmail'] },
		},
		default: '',
		placeholder: 'Email subject',
		description: 'Subject line of the email',
	},
	{
		displayName: 'Body',
		name: 'body',
		type: 'string',
		required: true,
		displayOptions: {
			show: { resource: ['mail'], operation: ['sendEmail'] },
		},
		default: '',
		typeOptions: {
			rows: 5,
		},
		description: 'Body text of the email (plain text or HTML)',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['mail'], operation: ['sendEmail'] },
		},
		options: [
			{
				displayName: 'CC',
				name: 'cc',
				type: 'string',
				default: '',
				placeholder: 'cc@example.com',
				description: 'Carbon copy recipient(s). Multiple addresses separated by commas.',
			},
			{
				displayName: 'BCC',
				name: 'bcc',
				type: 'string',
				default: '',
				placeholder: 'bcc@example.com',
				description: 'Blind carbon copy recipient(s). Multiple addresses separated by commas.',
			},
			{
				displayName: 'Send as HTML',
				name: 'isHtml',
				type: 'boolean',
				default: false,
				description: 'Whether to treat the body as HTML instead of plain text',
			},
		],
	},
	{
		displayName: 'Attachments',
		name: 'attachments',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		displayOptions: {
			show: { resource: ['mail'], operation: ['sendEmail'] },
		},
		placeholder: 'Add Attachment',
		default: {},
		options: [
			{
				name: 'attachment',
				displayName: 'Attachment',
				values: [
					{
						displayName: 'Binary Property',
						name: 'binaryPropertyName',
						type: 'string',
						default: 'data',
						hint: 'Name of the binary property from an upstream node (e.g. "data" from Read/Download File)',
						description: 'The binary property in the input item that holds the file to attach',
					},
					{
						displayName: 'File Name',
						name: 'fileName',
						type: 'string',
						default: '',
						description: 'Override the attachment filename. Leave empty to use the name from the binary data.',
					},
				],
			},
		],
	},

	// ─── Get Emails ───────────────────────────────────────────────────────────────
	{
		displayName: 'Mailbox',
		name: 'mailbox',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getMailboxOptions' },
		displayOptions: {
			show: { resource: ['mail'], operation: ['getEmails'] },
		},
		default: 'INBOX',
		description: 'Mailbox to read from. Common iCloud names: INBOX, "Sent Messages", Drafts, "Deleted Messages", Junk.',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: { resource: ['mail'], operation: ['getEmails'] },
		},
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		default: 10,
		description: 'Maximum number of emails to return (newest first)',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: ['mail'], operation: ['getEmails'] },
		},
		options: [
			{
				displayName: 'From',
				name: 'filterFrom',
				type: 'string',
				default: '',
				description: 'Filter emails by sender address or name',
			},
			{
				displayName: 'Subject Contains',
				name: 'filterSubject',
				type: 'string',
				default: '',
				description: 'Filter emails where subject contains this text',
			},
			{
				displayName: 'Only Unread',
				name: 'onlyUnread',
				type: 'boolean',
				default: false,
				description: 'Whether to return only unread emails',
			},
			{
				displayName: 'Received Since',
				name: 'since',
				type: 'dateTime',
				default: '',
				description: 'Return only emails received after this date/time',
			},
		],
	},

	// ─── Get Email by ID ──────────────────────────────────────────────────────────
	{
		displayName: 'Email UID',
		name: 'uid',
		type: 'number',
		required: true,
		displayOptions: {
			show: { resource: ['mail'], operation: ['getEmailById', 'moveEmail', 'deleteEmail'] },
		},
		default: 0,
		description: 'The IMAP UID of the email (returned by Get Emails)',
	},
	{
		displayName: 'Mailbox',
		name: 'mailbox',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getMailboxOptions' },
		displayOptions: {
			show: { resource: ['mail'], operation: ['getEmailById', 'deleteEmail'] },
		},
		default: 'INBOX',
		description: 'Mailbox containing the email.',
	},

	// ─── Move Email ───────────────────────────────────────────────────────────────
	{
		displayName: 'From Mailbox',
		name: 'fromMailbox',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getMailboxOptions' },
		required: true,
		displayOptions: {
			show: { resource: ['mail'], operation: ['moveEmail'] },
		},
		default: 'INBOX',
		description: 'Source mailbox containing the email to move.',
	},
	{
		displayName: 'To Mailbox',
		name: 'toMailbox',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getMailboxOptions' },
		required: true,
		displayOptions: {
			show: { resource: ['mail'], operation: ['moveEmail'] },
		},
		default: '',
		description: 'Destination mailbox to move the email to.',
	},
];
