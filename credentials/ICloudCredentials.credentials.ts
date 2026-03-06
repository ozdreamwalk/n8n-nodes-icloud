import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class ICloudCredentials implements ICredentialType {
	name = 'iCloudCredentials';
	displayName = 'Apple iCloud Credentials';
	documentationUrl = 'https://support.apple.com/en-us/102654';
	icon = 'file:../nodes/ICloud/icloud.svg' as const;

	properties: INodeProperties[] = [
		{
			displayName: 'Apple ID',
			name: 'appleId',
			type: 'string',
			default: '',
			placeholder: 'yourname@icloud.com',
			description:
				'Your Apple ID email address. Must have Two-Factor Authentication enabled.',
			required: true,
		},
		{
			displayName: 'App-Specific Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			placeholder: 'xxxx-xxxx-xxxx-xxxx',
			description:
				'App-Specific Password generated at appleid.apple.com. Required for third-party app access. Format: xxxx-xxxx-xxxx-xxxx',
			required: true,
		},
		{
			displayName: 'Setup Instructions',
			name: 'setupNotice',
			type: 'notice',
			default: '',
			displayOptions: {
				show: {},
			},
			description:
				'<strong>Prerequisites:</strong><br/>' +
				'1. Enable Two-Factor Authentication on your Apple ID<br/>' +
				'2. Go to <a href="https://appleid.apple.com" target="_blank">appleid.apple.com</a><br/>' +
				'3. Sign In → App-Specific Passwords → Generate password<br/>' +
				'4. Enter the generated password above (format: xxxx-xxxx-xxxx-xxxx)',
		},
	];
}
