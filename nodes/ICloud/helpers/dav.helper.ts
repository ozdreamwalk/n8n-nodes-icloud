import { createDAVClient } from 'tsdav';
import type { DAVCalendar, DAVCalendarObject, DAVObject } from 'tsdav';

export interface DavCredentials {
	appleId: string;
	password: string;
}

export interface CalendarInfo {
	url: string;
	calendarId: string;
	displayName: string;
	description?: string;
	color?: string;
}

export interface CalendarEvent {
	uid: string;
	summary: string;
	description?: string;
	location?: string;
	start: string;
	end: string;
	allDay: boolean;
	timezone?: string;
	status?: string;
	availability?: 'free' | 'busy';
}

export interface ContactInfo {
	uid: string;
	fullName?: string;
	firstName?: string;
	lastName?: string;
	emails: string[];
	phones: string[];
	notes?: string;
	org?: string;
	title?: string;
	birthday?: string;
	address?: string;
}

export interface CreateEventOptions {
	calendarUrl: string;
	summary: string;
	start: string;
	end: string;
	description?: string;
	location?: string;
	allDay?: boolean;
	timezone?: string;
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

	return calendars.map((cal) => {
		const segments = cal.url.replace(/\/$/, '').split('/');
		const calendarId = segments[segments.length - 1] || cal.url;
		return {
			url: cal.url,
			calendarId,
			displayName: (cal.displayName as string) ?? 'Unnamed Calendar',
			description: cal.description as string | undefined,
			color: cal.calendarColor as string | undefined,
		};
	});
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
				allEvents.push(parsed);
			}
		}
	}

	return allEvents;
}

export async function createEvent(
	credentials: DavCredentials,
	options: CreateEventOptions,
): Promise<{ url: string; etag: string; uid: string }> {
	if (new Date(options.end) <= new Date(options.start)) {
		throw new Error('End date/time must be after start date/time');
	}

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
		uid,
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveEventUrl(client: any, calendarUrl: string, uid: string): Promise<{ url: string; data: string; etag: string }> {
	const directUrl = `${calendarUrl}${uid}.ics`;
	const response = await client.fetchCalendarObjects({
		calendar: { url: calendarUrl } as DAVCalendar,
		objectUrls: [directUrl],
	});
	if (response.length && response[0].data) return response[0] as { url: string; data: string; etag: string };

	// Fallback: full scan by UID
	const all: DAVCalendarObject[] = await client.fetchCalendarObjects({ calendar: { url: calendarUrl } as DAVCalendar });
	const match = all.find((o) => {
		const parsed = parseIcal(o.data as string);
		return parsed?.uid === uid;
	});
	if (!match) throw new Error(`Event not found: UID ${uid}`);
	return match as unknown as { url: string; data: string; etag: string };
}

export async function updateEvent(
	credentials: DavCredentials,
	calendarUrl: string,
	uid: string,
	updates: Partial<Omit<CreateEventOptions, 'calendarUrl'>>,
): Promise<void> {
	const client = await createCalDAVClient(credentials);

	const existing = await resolveEventUrl(client, calendarUrl, uid);
	const parsed = parseIcal(existing.data);
	if (!parsed) throw new Error('Could not parse existing event');

	const merged: CreateEventOptions = {
		calendarUrl,
		summary: updates.summary ?? parsed.summary,
		start: updates.start ?? parsed.start,
		end: updates.end ?? parsed.end,
		description: updates.description ?? parsed.description,
		location: updates.location ?? parsed.location,
		allDay: updates.allDay ?? parsed.allDay,
		timezone: updates.timezone ?? parsed.timezone,
	};

	await client.updateCalendarObject({
		calendarObject: {
			url: existing.url,
			data: buildIcal(uid, merged),
			etag: existing.etag,
		},
	});
}

export async function deleteEvent(
	credentials: DavCredentials,
	calendarUrl: string,
	uid: string,
): Promise<void> {
	const client = await createCalDAVClient(credentials);

	const existing = await resolveEventUrl(client, calendarUrl, uid);
	await client.deleteCalendarObject({
		calendarObject: { url: existing.url, etag: existing.etag },
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
				allContacts.push(parsed);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveContactUrl(client: any, uid: string): Promise<{ url: string; data: string; etag: string; addressBookUrl: string }> {
	const addressBooks = await client.fetchAddressBooks();

	for (const book of addressBooks) {
		// Try direct URL first
		const directUrl = `${book.url as string}${uid}.vcf`;
		const direct: DAVObject[] = await client.fetchVCards({ addressBook: book, objectUrls: [directUrl] }).catch(() => []);
		if (direct.length && direct[0].data) {
			return { url: direct[0].url as string, data: direct[0].data as string, etag: direct[0].etag as string, addressBookUrl: book.url as string };
		}

		// Fallback: full scan by UID
		const all: DAVObject[] = await client.fetchVCards({ addressBook: book });
		const match = all.find((o) => {
			const parsed = parseVcard(o.data as string);
			return parsed?.uid === uid;
		});
		if (match) {
			return { url: match.url as string, data: match.data as string, etag: match.etag as string, addressBookUrl: book.url as string };
		}
	}

	throw new Error(`Contact not found: UID ${uid}`);
}

export async function updateContact(
	credentials: DavCredentials,
	uid: string,
	updates: Partial<Omit<CreateContactOptions, 'addressBookUrl'>>,
): Promise<void> {
	const client = await createCardDAVClient(credentials);

	const existing = await resolveContactUrl(client, uid);
	const parsed = parseVcard(existing.data);
	if (!parsed) throw new Error('Could not parse existing contact');

	const merged: CreateContactOptions = {
		addressBookUrl: existing.addressBookUrl,
		firstName: updates.firstName ?? parsed.firstName,
		lastName: updates.lastName ?? parsed.lastName,
		email: updates.email ?? parsed.emails[0],
		phone: updates.phone ?? parsed.phones[0],
		notes: updates.notes ?? parsed.notes,
	};

	await client.updateVCard({
		vCard: {
			url: existing.url,
			data: buildVcard(uid, merged),
			etag: existing.etag,
		},
	});
}

export async function deleteContact(
	credentials: DavCredentials,
	uid: string,
): Promise<void> {
	const client = await createCardDAVClient(credentials);

	const existing = await resolveContactUrl(client, uid);
	await client.deleteVCard({
		vCard: { url: existing.url, etag: existing.etag },
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
	timezone?: string;
	status?: string;
	availability?: 'free' | 'busy';
}

function parseIcal(icalString: string): ParsedEvent | null {
	try {
		const lines = icalString.replace(/\r\n\s/g, '').split(/\r\n|\n/);

		const getValue = (key: string): string | undefined =>
			lines.find((l) => l.startsWith(key + ':') || l.startsWith(key + ';'))
				?.replace(/^[^:]+:/, '')
				.trim();

		// Extract TZID from lines like "DTSTART;TZID=Europe/Berlin:20230101T120000"
		const getTzid = (key: string): string | undefined => {
			const line = lines.find((l) => l.startsWith(key + ':') || l.startsWith(key + ';'));
			return line?.match(/;TZID=([^:;]+)/)?.[1];
		};

		const uid = getValue('UID') ?? '';
		const summary = getValue('SUMMARY') ?? '(no title)';
		const description = getValue('DESCRIPTION');
		const location = getValue('LOCATION');
		const statusRaw = getValue('STATUS');
		const transpRaw = getValue('TRANSP');

		const dtstart = getValue('DTSTART') ?? '';
		const dtend = getValue('DTEND') ?? '';
		const timezone = getTzid('DTSTART');

		const allDay = dtstart.length === 8; // DATE format: YYYYMMDD

		const parseDate = (d: string): string => {
			if (d.length === 8) {
				// All-day: YYYYMMDD → YYYY-MM-DD
				return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
			}
			// DateTime: YYYYMMDDTHHmmss[Z]
			const isUtc = d.endsWith('Z');
			const clean = d.replace('Z', '');
			const formatted = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`;
			return isUtc ? `${formatted}Z` : formatted;
		};

		return {
			uid,
			summary,
			description,
			location,
			start: parseDate(dtstart),
			end: parseDate(dtend),
			allDay,
			timezone,
			status: statusRaw,
			// RFC 5545 §3.8.2.7: TRANSP default is OPAQUE (busy). All-day events get no default.
			availability: transpRaw === 'TRANSPARENT' ? 'free' : allDay ? undefined : 'busy',
		};
	} catch {
		return null;
	}
}

function buildIcal(uid: string, options: CreateEventOptions): string {
	const allDay = options.allDay ?? false;
	const timezone = options.timezone;

	// All-day: strip time, keep only date digits
	const formatAllDay = (dateStr: string): string => dateStr.replace(/-/g, '').slice(0, 8);

	// UTC: convert to UTC ISO and strip separators → YYYYMMDDTHHmmssZ
	const formatUtc = (dateStr: string): string =>
		new Date(dateStr).toISOString().replace(/[-:]/g, '').replace('.000', '');

	// Local (with TZID): strip any offset suffix to keep wall-clock time → YYYYMMDDTHHmmss
	const formatLocal = (dateStr: string): string =>
		dateStr
			.replace(/Z$/, '')
			.replace(/[+-]\d{2}:\d{2}$/, '')
			.replace(/-/g, '')
			.replace(/:/g, '');

	let dtstart: string;
	let dtend: string;

	if (allDay) {
		dtstart = `DTSTART;VALUE=DATE:${formatAllDay(options.start)}`;
		dtend = `DTEND;VALUE=DATE:${formatAllDay(options.end)}`;
	} else if (timezone) {
		dtstart = `DTSTART;TZID=${timezone}:${formatLocal(options.start)}`;
		dtend = `DTEND;TZID=${timezone}:${formatLocal(options.end)}`;
	} else {
		dtstart = `DTSTART:${formatUtc(options.start)}`;
		dtend = `DTEND:${formatUtc(options.end)}`;
	}

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
	org?: string;
	title?: string;
	birthday?: string;
	address?: string;
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

		// iCloud writes item-prefixed lines: item1.EMAIL, item2.TEL, etc.
		const emails = lines
			.filter((l) => /^(?:item\d+\.)?EMAIL/i.test(l))
			.map((l) => l.replace(/^[^:]+:/, '').trim());

		const phones = lines
			.filter((l) => /^(?:item\d+\.)?TEL/i.test(l))
			.map((l) => l.replace(/^[^:]+:/, '').trim());

		const notes = getValue('NOTE');
		const org = getValue('ORG') ?? undefined;
		const title = getValue('TITLE') ?? undefined;
		const birthday = getValue('BDAY') ?? undefined;

		// ADR format: ;type=...:poBox;ext;street;city;region;postal;country — iCloud may prefix with item{N}.
		const adrLine = lines.find((l) => /^(?:item\d+\.)?ADR/i.test(l));
		let address: string | undefined;
		if (adrLine) {
			const adrValue = adrLine.replace(/^[^:]+:/, '').trim();
			const parts = adrValue.split(';');
			// parts: [poBox, ext, street, city, region, postal, country]
			const street = parts[2]?.trim();
			const city = parts[3]?.trim();
			const postal = parts[5]?.trim();
			const country = parts[6]?.trim();
			address = [street, postal && city ? `${postal} ${city}` : city, country]
				.filter(Boolean)
				.join(', ') || undefined;
		}

		return {
			uid,
			fullName: fn,
			firstName: firstName || undefined,
			lastName: lastName || undefined,
			emails,
			phones,
			notes,
			org,
			title,
			birthday,
			address,
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
