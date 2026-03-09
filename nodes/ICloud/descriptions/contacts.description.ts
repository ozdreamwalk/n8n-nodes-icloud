import type { INodeProperties } from 'n8n-workflow';

export const contactsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['contacts'],
			},
		},
		options: [
			{
				name: 'Get Contacts',
				value: 'getContacts',
				description: 'Retrieve contacts from iCloud Contacts',
				action: 'Get contacts from iCloud',
			},
			{
				name: 'Create Contact',
				value: 'createContact',
				description: 'Create a new contact in iCloud Contacts',
				action: 'Create a contact in iCloud',
			},
			{
				name: 'Update Contact',
				value: 'updateContact',
				description: 'Update an existing iCloud contact',
				action: 'Update a contact in iCloud',
			},
			{
				name: 'Delete Contact',
				value: 'deleteContact',
				description: 'Delete a contact from iCloud Contacts',
				action: 'Delete a contact from iCloud',
			},
		],
		default: 'getContacts',
	},
];

export const contactsFields: INodeProperties[] = [
	// ─── Get Contacts ─────────────────────────────────────────────────────────────
	{
		displayName: 'Search Query',
		name: 'searchQuery',
		type: 'string',
		displayOptions: {
			show: { resource: ['contacts'], operation: ['getContacts'] },
		},
		default: '',
		placeholder: 'John Doe or john@example.com',
		description:
			'Optional search query to filter contacts by name or email. Leave empty to retrieve all contacts.',
	},

	// ─── Create Contact ───────────────────────────────────────────────────────────
	{
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		displayOptions: {
			show: { resource: ['contacts'], operation: ['createContact'] },
		},
		default: '',
		placeholder: 'John',
		description: "Contact's first name",
	},
	{
		displayName: 'Last Name',
		name: 'lastName',
		type: 'string',
		displayOptions: {
			show: { resource: ['contacts'], operation: ['createContact'] },
		},
		default: '',
		placeholder: 'Doe',
		description: "Contact's last name",
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['contacts'], operation: ['createContact'] },
		},
		options: [
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				default: '',
				placeholder: 'john@example.com',
				description: "Contact's email address",
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				default: '',
				placeholder: '+1 555 123 4567',
				description: "Contact's phone number",
			},
			{
				displayName: 'Notes',
				name: 'notes',
				type: 'string',
				default: '',
				typeOptions: { rows: 3 },
				description: 'Additional notes for the contact',
			},
			{
				displayName: 'Address Book URL',
				name: 'addressBookUrl',
				type: 'string',
				default: '',
				description:
					'URL of a specific address book to add the contact to. Leave empty to use the default address book.',
			},
		],
	},

	// ─── Update / Delete Contact ──────────────────────────────────────────────────
	{
		displayName: 'Contact UID',
		name: 'uid',
		type: 'string',
		required: true,
		displayOptions: {
			show: { resource: ['contacts'], operation: ['updateContact', 'deleteContact'] },
		},
		default: '',
		placeholder: 'abc12345-def6-...',
		description: 'UID of the contact to update or delete. Returned as the "uid" field by "Get Contacts" or "Create Contact".',
	},
	{
		displayName: 'Fields to Update',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['contacts'], operation: ['updateContact'] },
		},
		options: [
			{
				displayName: 'First Name',
				name: 'firstName',
				type: 'string',
				default: '',
				description: 'New first name for the contact',
			},
			{
				displayName: 'Last Name',
				name: 'lastName',
				type: 'string',
				default: '',
				description: 'New last name for the contact',
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				default: '',
				description: 'New email address for the contact',
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				default: '',
				description: 'New phone number for the contact',
			},
			{
				displayName: 'Notes',
				name: 'notes',
				type: 'string',
				default: '',
				typeOptions: { rows: 3 },
				description: 'New notes for the contact',
			},
		],
	},
];
