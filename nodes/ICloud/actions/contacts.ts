import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
	getContacts,
	createContact,
	updateContact,
	deleteContact,
} from '../helpers/dav.helper';
import type { DavCredentials } from '../helpers/dav.helper';

export async function handleContactsOperation(
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
		case 'getContacts': {
			const searchQuery = this.getNodeParameter('searchQuery', i, '') as string;

			const contacts = await getContacts(creds, searchQuery || undefined);
			return this.helpers.returnJsonArray(contacts as unknown as IDataObject[]);
		}

		case 'createContact': {
			const firstName = this.getNodeParameter('firstName', i, '') as string;
			const lastName = this.getNodeParameter('lastName', i, '') as string;
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as {
				email?: string;
				phone?: string;
				notes?: string;
				addressBookUrl?: string;
			};

			if (!firstName && !lastName) {
				throw new NodeOperationError(
					this.getNode(),
					'Please provide at least a first name or last name for the contact',
					{ itemIndex: i },
				);
			}

			const result = await createContact(creds, {
				firstName: firstName || undefined,
				lastName: lastName || undefined,
				email: additionalFields.email,
				phone: additionalFields.phone,
				notes: additionalFields.notes,
				addressBookUrl: additionalFields.addressBookUrl || '',
			});

			return this.helpers.returnJsonArray([
				{
					success: true,
					etag: result.etag,
					firstName,
					lastName,
					email: additionalFields.email,
					phone: additionalFields.phone,
				},
			]);
		}

		case 'updateContact': {
			const uid = this.getNodeParameter('uid', i) as string;
			const updateFields = this.getNodeParameter('updateFields', i, {}) as {
				firstName?: string;
				lastName?: string;
				email?: string;
				phone?: string;
				notes?: string;
			};

			if (Object.keys(updateFields).length === 0) {
				throw new NodeOperationError(
					this.getNode(),
					'Please specify at least one field to update',
					{ itemIndex: i },
				);
			}

			await updateContact(creds, uid, updateFields);

			return this.helpers.returnJsonArray([
				{
					success: true,
					uid,
					updated: updateFields,
				},
			]);
		}

		case 'deleteContact': {
			const uid = this.getNodeParameter('uid', i) as string;

			await deleteContact(creds, uid);

			return this.helpers.returnJsonArray([
				{
					success: true,
					uid,
					deleted: true,
				},
			]);
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown Contacts operation: ${operation}`, {
				itemIndex: i,
			});
	}
}
