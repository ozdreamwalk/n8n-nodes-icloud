import { createDAVClient } from 'tsdav';
import type { DAVCalendar, DAVCalendarObject, DAVObject } from 'tsdav';

export interface DavCredentials {
	appleId: string;
	password: string;
}

export interface CalendarInfo {
	url: string;
	displayName: string;
	description?: string;
	ctag?: string;
	color?: string;
}

export interface CalendarEvent {
	url: string;
	uid: string;
	summary: string;
	description?: string;
	location?: string;
	start: string;
	end: string;
	allDay: boolean;
}

export interface ContactInfo {
	url: string;
	uid: string;
	fullName?: string;
	firstName?: string;
	lastName?: string;
	emails: string[];
	phones: string[];
	notes?: string;
}

export interface CreateEventOptions {
	calendarUrl: string;
	summary: string;
	start: string;
	end: string;
	description?: string;
	location?: string;
	allDay?: boolean;
}

export interface CreateContactOptions {
	addressBookUrl: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	phone?: string;
	notes?: string;
}

// CalDAV discovery base URL — tsdav handles server-specific redirect (p01-..., p02-..., etc.)
const CALDAV_URL = 'https://caldav.icloud.com';
const CARDDAV_URL = 'https://contacts.icloud.com';

// tsdav's createDAVClient returns a plain object, not a class instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createCalDAVClient(credentials: DavCredentials): Promise<any> {
	return createDAVClient({
		serverUrl: CALDAV_URL,
		credentials: {
			username: credentials.appleId,
			password: credentials.password,
		},
		authMethod: 'Basic',
		defaultAccountType: 'caldav',
	});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createCardDAVClient(credentials: DavCredentials): Promise<any> {
	return createDAVClient({
		serverUrl: CARDDAV_URL,
		credentials: {
			username: credentials.appleId,
			password: credentials.password,
		},
		authMethod: 'Basic',
		defaultAccountType: 'carddav',
	});
}

// ─── Calendar Operations ──────────────────────────────────────────────────────

export async function getCalendars(credentials: DavCredentials): Promise<CalendarInfo[]> {
	const client = await createCalDAVClient(credentials);
	const calendars: DAVCalendar[] = await client.fetchCalendars();

	return calendars.map((cal) => ({
		url: cal.url,
		displayName: (cal.displayName as string) ?? 'Unnamed Calendar',
		description: cal.description as string | undefined,
		ctag: cal.ctag as string | undefined,
		color: cal.calendarColor as string | undefined,
	}));
}

export async function getEvents(
	credentials: DavCredentials,
	calendarUrl?: string,
	start?: string,
	end?: string,
): Promise<CalendarEvent[]> {
	const client = await createCalDAVClient(credentials);

	let calendars: DAVCalendar[];
	if (calendarUrl) {
		calendars = [{ url: calendarUrl } as DAVCalendar];
	} else {
		calendars = await client.fetchCalendars();
	}

	const allEvents: CalendarEvent[] = [];

	for (const calendar of calendars) {
		const objects: DAVCalendarObject[] = await client.fetchCalendarObjects({
			calendar,
			timeRange: start && end ? { start, end } : undefined,
		});

		for (const obj of objects) {
			const parsed = parseIcal(obj.data as string);
			if (parsed) {
				allEvents.push({
					url: obj.url,
					...parsed,
				});
			}
		}
	}

	return allEvents;
}

export async function createEvent(
	credentials: DavCredentials,
	options: CreateEventOptions,
): Promise<{ url: string; etag: string }> {
	const client = await createCalDAVClient(credentials);

	const uid = generateUid();
	const ical = buildIcal(uid, options);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result: any = await client.createCalendarObject({
		calendar: { url: options.calendarUrl } as DAVCalendar,
		filename: `${uid}.ics`,
		iCalString: ical,
	});

	return {
		url: (result?.url as string) ?? `${options.calendarUrl}${uid}.ics`,
		etag: (result?.etag as string) ?? '',
	};
}

export async function updateEvent(
	credentials: DavCredentials,
	eventUrl: string,
	updates: Partial<Omit<CreateEventOptions, 'calendarUrl'>>,
): Promise<void> {
	const client = await createCalDAVClient(credentials);

	// Fetch existing event
	const response = await client.fetchCalendarObjects({
		calendar: { url: eventUrl } as DAVCalendar,
	});

	if (!response.length) {
		throw new Error(`Event not found: ${eventUrl}`);
	}

	const existing = response[0];
	const parsed = parseIcal(existing.data as string);
	if (!parsed) throw new Error('Could not parse existing event');

	const uid = parsed.uid;
	const merged: CreateEventOptions = {
		calendarUrl: eventUrl.substring(0, eventUrl.lastIndexOf('/') + 1),
		summary: updates.summary ?? parsed.summary,
		start: updates.start ?? parsed.start,
		end: updates.end ?? parsed.end,
		description: updates.description ?? parsed.description,
		location: updates.location ?? parsed.location,
		allDay: updates.allDay ?? parsed.allDay,
	};

	await client.updateCalendarObject({
		calendarObject: {
			url: eventUrl,
			data: buildIcal(uid, merged),
			etag: existing.etag,
		},
	});
}

export async function deleteEvent(
	credentials: DavCredentials,
	eventUrl: string,
): Promise<void> {
	const client = await createCalDAVClient(credentials);

	await client.deleteCalendarObject({
		calendarObject: { url: eventUrl },
	});
}

// ─── Contact Operations ────────────────────────────────────────────────────────

export async function getContacts(
	credentials: DavCredentials,
	searchQuery?: string,
): Promise<ContactInfo[]> {
	const client = await createCardDAVClient(credentials);
	const addressBooks = await client.fetchAddressBooks();

	const allContacts: ContactInfo[] = [];

	for (const book of addressBooks) {
		const objects: DAVObject[] = await client.fetchVCards({
			addressBook: book,
		});

		for (const obj of objects) {
			const parsed = parseVcard(obj.data as string);
			if (parsed) {
				// Apply search filter if provided
				if (searchQuery) {
					const q = searchQuery.toLowerCase();
					const matchName = parsed.fullName?.toLowerCase().includes(q) ?? false;
					const matchEmail = parsed.emails.some((e) => e.toLowerCase().includes(q));
					if (!matchName && !matchEmail) continue;
				}
				allContacts.push({
					url: obj.url,
					...parsed,
				});
			}
		}
	}

	return allContacts;
}

export async function createContact(
	credentials: DavCredentials,
	options: CreateContactOptions,
): Promise<{ url: string; etag: string }> {
	const client = await createCardDAVClient(credentials);
	const addressBooks = await client.fetchAddressBooks();

	if (!addressBooks.length) {
		throw new Error('No address book found in iCloud Contacts');
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const targetBook = options.addressBookUrl
		? addressBooks.find((b: any) => b.url === options.addressBookUrl) ?? addressBooks[0]
		: addressBooks[0];

	const uid = generateUid();
	const vcard = buildVcard(uid, options);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result: any = await client.createVCard({
		addressBook: targetBook,
		filename: `${uid}.vcf`,
		vCardString: vcard,
	});

	return {
		url: (result?.url as string) ?? `${targetBook.url}${uid}.vcf`,
		etag: (result?.etag as string) ?? '',
	};
}

export async function updateContact(
	credentials: DavCredentials,
	contactUrl: string,
	updates: Partial<Omit<CreateContactOptions, 'addressBookUrl'>>,
): Promise<void> {
	const client = await createCardDAVClient(credentials);
	const addressBooks = await client.fetchAddressBooks();

	let existing: DAVObject | undefined;

	for (const book of addressBooks) {
		const objects = await client.fetchVCards({ addressBook: book });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		existing = objects.find((o: any) => o.url === contactUrl);
		if (existing) break;
	}

	if (!existing) {
		throw new Error(`Contact not found: ${contactUrl}`);
	}

	const parsed = parseVcard(existing.data as string);
	if (!parsed) throw new Error('Could not parse existing contact');

	const merged: CreateContactOptions = {
		addressBookUrl: contactUrl.substring(0, contactUrl.lastIndexOf('/') + 1),
		firstName: updates.firstName ?? parsed.firstName,
		lastName: updates.lastName ?? parsed.lastName,
		email: updates.email ?? parsed.emails[0],
		phone: updates.phone ?? parsed.phones[0],
		notes: updates.notes ?? parsed.notes,
	};

	await client.updateVCard({
		vCard: {
			url: contactUrl,
			data: buildVcard(parsed.uid, merged),
			etag: existing.etag,
		},
	});
}

export async function deleteContact(
	credentials: DavCredentials,
	contactUrl: string,
): Promise<void> {
	const client = await createCardDAVClient(credentials);

	await client.deleteVCard({
		vCard: { url: contactUrl },
	});
}

// ─── iCal Helpers ─────────────────────────────────────────────────────────────

interface ParsedEvent {
	uid: string;
	summary: string;
	description?: string;
	location?: string;
	start: string;
	end: string;
	allDay: boolean;
}

function parseIcal(icalString: string): ParsedEvent | null {
	try {
		const lines = icalString.replace(/\r\n\s/g, '').split(/\r\n|\n/);
		const getValue = (key: string): string | undefined =>
			lines.find((l) => l.startsWith(key + ':') || l.startsWith(key + ';'))
				?.replace(/^[^:]+:/, '')
				.trim();

		const uid = getValue('UID') ?? '';
		const summary = getValue('SUMMARY') ?? '(no title)';
		const description = getValue('DESCRIPTION');
		const location = getValue('LOCATION');

		const dtstart = getValue('DTSTART') ?? '';
		const dtend = getValue('DTEND') ?? '';

		const allDay = dtstart.length === 8; // DATE format: YYYYMMDD

		const parseDate = (d: string): string => {
			if (d.length === 8) {
				return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
			}
			// Remove timezone suffixes like Z or T...
			const clean = d.replace('Z', '').replace('T', ' ');
			return clean;
		};

		return {
			uid,
			summary,
			description,
			location,
			start: parseDate(dtstart),
			end: parseDate(dtend),
			allDay,
		};
	} catch {
		return null;
	}
}

function buildIcal(uid: string, options: CreateEventOptions): string {
	const formatDate = (dateStr: string, allDay: boolean): string => {
		if (allDay) {
			return dateStr.replace(/-/g, '');
		}
		const d = new Date(dateStr);
		return d.toISOString().replace(/[-:]/g, '').replace('.000', '');
	};

	const allDay = options.allDay ?? false;
	const dtstart = allDay
		? `DTSTART;VALUE=DATE:${formatDate(options.start, true)}`
		: `DTSTART:${formatDate(options.start, false)}`;
	const dtend = allDay
		? `DTEND;VALUE=DATE:${formatDate(options.end, true)}`
		: `DTEND:${formatDate(options.end, false)}`;

	const now = new Date().toISOString().replace(/[-:]/g, '').replace('.000', '');

	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//n8n-nodes-apple-icloud//EN',
		'BEGIN:VEVENT',
		`UID:${uid}`,
		`DTSTAMP:${now}`,
		dtstart,
		dtend,
		`SUMMARY:${escapeIcal(options.summary)}`,
	];

	if (options.description) lines.push(`DESCRIPTION:${escapeIcal(options.description)}`);
	if (options.location) lines.push(`LOCATION:${escapeIcal(options.location)}`);

	lines.push('END:VEVENT', 'END:VCALENDAR');

	return lines.join('\r\n');
}

function escapeIcal(str: string): string {
	return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// ─── vCard Helpers ─────────────────────────────────────────────────────────────

interface ParsedContact {
	uid: string;
	fullName?: string;
	firstName?: string;
	lastName?: string;
	emails: string[];
	phones: string[];
	notes?: string;
}

function parseVcard(vcardString: string): ParsedContact | null {
	try {
		const lines = vcardString.split(/\r\n|\n/);
		const getValue = (key: string): string | undefined =>
			lines.find((l) => l.startsWith(key + ':') || l.startsWith(key + ';'))
				?.replace(/^[^:]+:/, '')
				.trim();

		const uid = getValue('UID') ?? generateUid();
		const fn = getValue('FN');

		const nLine = getValue('N');
		const nameParts = nLine?.split(';') ?? [];
		const lastName = nameParts[0] ?? '';
		const firstName = nameParts[1] ?? '';

		const emails = lines
			.filter((l) => l.startsWith('EMAIL'))
			.map((l) => l.replace(/^[^:]+:/, '').trim());

		const phones = lines
			.filter((l) => l.startsWith('TEL'))
			.map((l) => l.replace(/^[^:]+:/, '').trim());

		const notes = getValue('NOTE');

		return {
			uid,
			fullName: fn,
			firstName: firstName || undefined,
			lastName: lastName || undefined,
			emails,
			phones,
			notes,
		};
	} catch {
		return null;
	}
}

function buildVcard(uid: string, options: CreateContactOptions): string {
	const firstName = options.firstName ?? '';
	const lastName = options.lastName ?? '';
	const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';

	const lines = [
		'BEGIN:VCARD',
		'VERSION:3.0',
		`UID:${uid}`,
		`FN:${fullName}`,
		`N:${lastName};${firstName};;;`,
	];

	if (options.email) lines.push(`EMAIL;type=INTERNET;type=HOME:${options.email}`);
	if (options.phone) lines.push(`TEL;type=CELL:${options.phone}`);
	if (options.notes) lines.push(`NOTE:${options.notes}`);

	lines.push('END:VCARD');

	return lines.join('\r\n');
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function generateUid(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 10);
	return `${timestamp}-${random}@n8n-icloud`;
}
