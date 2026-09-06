import { createDAVClient } from 'tsdav';
import type { DAVAddressBook, DAVCalendar, DAVCalendarObject, DAVObject } from 'tsdav';

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
	url?: string;
	organizer?: CalendarParticipant;
	attendees?: CalendarParticipant[];
	recurrence?: CalendarRecurrence;
	alarms?: IcalComponent[];
	attachments?: CalendarAttachment[];
	categories?: string[];
	classification?: string;
	priority?: number;
	sequence?: number;
	created?: string;
	lastModified?: string;
	dtstamp?: string;
	duration?: string;
	geo?: { latitude: number; longitude: number };
	comments?: string[];
	contacts?: string[];
	resources?: string[];
	relatedTo?: IcalProperty[];
	requestStatus?: string[];
	properties?: IcalProperty[];
	components?: IcalComponent[];
	xProperties?: IcalProperty[];
	calendar: {
		url?: string;
		calendarId: string;
		displayName?: string;
	};
	dav?: {
		url: string;
		etag?: string;
	};
	rawIcal?: string;
}

export interface IcalProperty {
	name: string;
	value: string;
	rawValue: string;
	parameters: Record<string, string[]>;
}

export interface IcalComponent {
	name: string;
	properties: IcalProperty[];
	components: IcalComponent[];
}

export interface CalendarParticipant {
	uri?: string;
	email?: string;
	name?: string;
	role?: string;
	participationStatus?: string;
	rsvp?: boolean;
	userType?: string;
	delegatedTo?: string[];
	delegatedFrom?: string[];
	member?: string[];
	directory?: string;
	sentBy?: string;
	language?: string;
	parameters?: Record<string, string[]>;
}

export interface CalendarRecurrence {
	rules?: string[];
	dates?: string[];
	excludedDates?: string[];
	recurrenceId?: string;
}

export interface CalendarAttachment {
	value: string;
	formatType?: string;
	encoding?: string;
	valueType?: string;
	parameters?: Record<string, string[]>;
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
	url?: string;
	organizer?: CalendarParticipant | null;
	attendees?: CalendarParticipant[];
	recurrenceRules?: string[];
	recurrenceDates?: string[];
	excludedDates?: string[];
	alarms?: IcalComponent[];
	attachments?: CalendarAttachment[];
	categories?: string[];
	status?: string;
	availability?: 'free' | 'busy';
	classification?: string;
	priority?: number;
	sequence?: number;
	geo?: { latitude: number; longitude: number } | null;
	comments?: string[];
	contacts?: string[];
	resources?: string[];
	relatedTo?: IcalProperty[];
	requestStatus?: string[];
	customProperties?: IcalProperty[];
	customComponents?: IcalComponent[];
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
	includeRawData = false,
): Promise<CalendarEvent[]> {
	const client = await createCalDAVClient(credentials);

	let calendars: DAVCalendar[];
	if (calendarUrl) {
		calendars = [{ url: calendarUrl } as DAVCalendar];
	} else {
		calendars = await client.fetchCalendars();
	}

	const allEvents: CalendarEvent[] = [];
	const shouldExpand = Boolean(start && end);

	for (const calendar of calendars) {
		const objects: DAVCalendarObject[] = await client.fetchCalendarObjects({
			calendar,
			timeRange: start && end ? { start, end } : undefined,
			// Ask the CalDAV server to replace recurring master events with the
			// concrete occurrences inside the requested time range.
			expand: shouldExpand,
		});

		for (const obj of objects) {
			const rawIcal = obj.data as string;
			const parsed = shouldExpand ? null : parseIcal(rawIcal);
			const parsedEvents = shouldExpand
				? parseIcalEvents(rawIcal)
				: parsed ? [parsed] : [];
			const segments = calendar.url.replace(/\/$/, '').split('/');
			const calendarId = segments[segments.length - 1] || calendar.url;

			for (const parsed of parsedEvents) {
				const event = compactParsedEvent(parsed, includeRawData);
				allEvents.push({
					...event,
					calendar: {
						calendarId,
						displayName: typeof calendar.displayName === 'string' ? calendar.displayName : undefined,
						...(includeRawData ? { url: calendar.url } : {}),
					},
					...(includeRawData ? {
						dav: { url: obj.url, etag: obj.etag },
						rawIcal,
					} : {}),
				});
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
	const updatedIcal = patchIcalEvent(existing.data, uid, updates);

	await client.updateCalendarObject({
		calendarObject: {
			url: existing.url,
			data: updatedIcal,
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
	const addressBooks: DAVAddressBook[] = await client.fetchAddressBooks();

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
	const addressBooks: DAVAddressBook[] = await client.fetchAddressBooks();

	if (!addressBooks.length) {
		throw new Error('No address book found in iCloud Contacts');
	}

	const targetBook = options.addressBookUrl
		? addressBooks.find((book) => book.url === options.addressBookUrl) ?? addressBooks[0]
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

type ParsedEvent = Omit<CalendarEvent, 'calendar' | 'dav' | 'rawIcal'>;

function compactParsedEvent(event: ParsedEvent, includeRawData: boolean): ParsedEvent {
	const {
		attendees,
		recurrence,
		alarms,
		attachments,
		categories,
		comments,
		contacts,
		resources,
		relatedTo,
		requestStatus,
		properties,
		components,
		xProperties,
		...core
	} = event;
	const compactRecurrence = recurrence ? {
		...(recurrence.rules?.length ? { rules: recurrence.rules } : {}),
		...(recurrence.dates?.length ? { dates: recurrence.dates } : {}),
		...(recurrence.excludedDates?.length ? { excludedDates: recurrence.excludedDates } : {}),
		...(recurrence.recurrenceId ? { recurrenceId: recurrence.recurrenceId } : {}),
	} : undefined;

	return {
		...core,
		...(attendees?.length ? { attendees } : {}),
		...(compactRecurrence && Object.keys(compactRecurrence).length ? { recurrence: compactRecurrence } : {}),
		...(alarms?.length ? { alarms } : {}),
		...(attachments?.length ? { attachments } : {}),
		...(categories?.length ? { categories } : {}),
		...(comments?.length ? { comments } : {}),
		...(contacts?.length ? { contacts } : {}),
		...(resources?.length ? { resources } : {}),
		...(relatedTo?.length ? { relatedTo } : {}),
		...(requestStatus?.length ? { requestStatus } : {}),
		...(includeRawData ? { properties, components, xProperties } : {}),
	};
}

function splitIcalList(value: string): string[] {
	const values: string[] = [];
	let current = '';
	let escaped = false;
	for (const character of value) {
		if (character === ',' && !escaped) {
			values.push(current);
			current = '';
			continue;
		}
		current += character;
		escaped = character === '\\' && !escaped;
		if (character !== '\\') escaped = false;
	}
	values.push(current);
	return values;
}

function unescapeIcalText(value: string): string {
	return value
		.replace(/\\[nN]/g, '\n')
		.replace(/\\,/g, ',')
		.replace(/\\;/g, ';')
		.replace(/\\\\/g, '\\');
}

function findDelimiter(value: string, delimiter: string): number {
	let quoted = false;
	for (let index = 0; index < value.length; index++) {
		if (value[index] === '"') quoted = !quoted;
		if (value[index] === delimiter && !quoted) return index;
	}
	return -1;
}

function parseProperty(line: string): IcalProperty | null {
	const colon = findDelimiter(line, ':');
	if (colon < 1) return null;

	const head = line.slice(0, colon);
	const rawValue = line.slice(colon + 1);
	const segments: string[] = [];
	let remaining = head;
	while (remaining) {
		const separator = findDelimiter(remaining, ';');
		if (separator === -1) {
			segments.push(remaining);
			break;
		}
		segments.push(remaining.slice(0, separator));
		remaining = remaining.slice(separator + 1);
	}

	const name = (segments.shift() ?? '').toUpperCase();
	const parameters: Record<string, string[]> = {};
	for (const segment of segments) {
		const equals = segment.indexOf('=');
		if (equals === -1) continue;
		const parameterName = segment.slice(0, equals).toUpperCase();
		const parameterValue = segment.slice(equals + 1).replace(/^"|"$/g, '');
		parameters[parameterName] = splitIcalList(parameterValue).map(unescapeIcalText);
	}

	return { name, value: unescapeIcalText(rawValue), rawValue, parameters };
}

function parseIcalDocument(icalString: string): IcalComponent | null {
	const lines = icalString.replace(/\r?\n[ \t]/g, '').split(/\r?\n/).filter(Boolean);
	const stack: IcalComponent[] = [];
	let root: IcalComponent | null = null;

	for (const line of lines) {
		if (line.toUpperCase().startsWith('BEGIN:')) {
			const component: IcalComponent = {
				name: line.slice(6).trim().toUpperCase(),
				properties: [],
				components: [],
			};
			if (stack.length) stack[stack.length - 1].components.push(component);
			else root = component;
			stack.push(component);
			continue;
		}
		if (line.toUpperCase().startsWith('END:')) {
			stack.pop();
			continue;
		}
		const property = parseProperty(line);
		if (property && stack.length) stack[stack.length - 1].properties.push(property);
	}

	return root;
}

function getProperties(component: IcalComponent, name: string): IcalProperty[] {
	return component.properties.filter((property) => property.name === name);
}

function getProperty(component: IcalComponent, name: string): IcalProperty | undefined {
	return component.properties.find((property) => property.name === name);
}

function parseIcalDate(property?: IcalProperty): string | undefined {
	if (!property?.rawValue) return undefined;
	const value = property.rawValue;
	if (property.parameters.VALUE?.includes('DATE') || /^\d{8}$/.test(value)) {
		return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
	}
	if (!/^\d{8}T\d{6}Z?$/.test(value)) return property.value;
	const isUtc = value.endsWith('Z');
	const clean = value.replace(/Z$/, '');
	const formatted = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`;
	return isUtc ? `${formatted}Z` : formatted;
}

function parseParticipant(property?: IcalProperty): CalendarParticipant | undefined {
	if (!property) return undefined;
	const parameter = (name: string): string | undefined => property.parameters[name]?.[0];
	const uri = property.value;
	return {
		uri,
		email: uri.toLowerCase().startsWith('mailto:') ? uri.slice(7) : undefined,
		name: parameter('CN'),
		role: parameter('ROLE')?.toLowerCase(),
		participationStatus: parameter('PARTSTAT')?.toLowerCase(),
		rsvp: parameter('RSVP') ? parameter('RSVP')?.toUpperCase() === 'TRUE' : undefined,
		userType: parameter('CUTYPE')?.toLowerCase(),
		delegatedTo: property.parameters['DELEGATED-TO'],
		delegatedFrom: property.parameters['DELEGATED-FROM'],
		member: property.parameters.MEMBER,
		directory: parameter('DIR'),
		sentBy: parameter('SENT-BY'),
		language: parameter('LANGUAGE'),
		parameters: property.parameters,
	};
}

function parseEventComponent(component: IcalComponent): ParsedEvent {
	const dtstart = getProperty(component, 'DTSTART');
	const dtend = getProperty(component, 'DTEND');
	const allDay = dtstart?.parameters.VALUE?.includes('DATE') ?? /^\d{8}$/.test(dtstart?.rawValue ?? '');
	const transp = getProperty(component, 'TRANSP')?.value.toUpperCase();
	const recurrenceId = parseIcalDate(getProperty(component, 'RECURRENCE-ID'));
	const geo = getProperty(component, 'GEO')?.value.split(';').map(Number);
	const numberValue = (name: string): number | undefined => {
		const value = getProperty(component, name)?.value;
		if (value === undefined || value === '') return undefined;
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	};
	const dateList = (name: string): string[] => getProperties(component, name).flatMap((property) =>
		splitIcalList(property.rawValue).map((value) => parseIcalDate({ ...property, rawValue: value, value }) ?? value),
	);
	const rules = getProperties(component, 'RRULE').map((property) => property.value);
	const dates = dateList('RDATE');
	const excludedDates = dateList('EXDATE');
	const attachments = getProperties(component, 'ATTACH').map((property) => ({
		value: property.value,
		formatType: property.parameters.FMTTYPE?.[0],
		encoding: property.parameters.ENCODING?.[0],
		valueType: property.parameters.VALUE?.[0],
		parameters: property.parameters,
	}));
	const knownNames = new Set([
		'UID', 'SUMMARY', 'DESCRIPTION', 'LOCATION', 'DTSTART', 'DTEND', 'DURATION', 'STATUS',
		'TRANSP', 'URL', 'ORGANIZER', 'ATTENDEE', 'RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID',
		'ATTACH', 'CATEGORIES', 'CLASS', 'PRIORITY', 'SEQUENCE', 'CREATED', 'LAST-MODIFIED',
		'DTSTAMP', 'GEO', 'COMMENT', 'CONTACT', 'RESOURCES', 'RELATED-TO', 'REQUEST-STATUS',
	]);

	return {
		uid: getProperty(component, 'UID')?.value ?? '',
		summary: getProperty(component, 'SUMMARY')?.value ?? '(no title)',
		description: getProperty(component, 'DESCRIPTION')?.value,
		location: getProperty(component, 'LOCATION')?.value,
		start: parseIcalDate(dtstart) ?? '',
		end: parseIcalDate(dtend) ?? '',
		allDay,
		timezone: dtstart?.parameters.TZID?.[0],
		status: getProperty(component, 'STATUS')?.value,
		availability: transp === 'TRANSPARENT' ? 'free' : allDay ? undefined : 'busy',
		url: getProperty(component, 'URL')?.value,
		organizer: parseParticipant(getProperty(component, 'ORGANIZER')),
		attendees: getProperties(component, 'ATTENDEE')
			.map((property) => parseParticipant(property))
			.filter((participant): participant is CalendarParticipant => Boolean(participant)),
		recurrence: rules.length || dates.length || excludedDates.length || recurrenceId
			? { rules, dates, excludedDates, recurrenceId }
			: undefined,
		alarms: component.components.filter((child) => child.name === 'VALARM'),
		attachments,
		categories: getProperties(component, 'CATEGORIES').flatMap((property) =>
			splitIcalList(property.rawValue).map(unescapeIcalText),
		),
		classification: getProperty(component, 'CLASS')?.value,
		priority: numberValue('PRIORITY'),
		sequence: numberValue('SEQUENCE'),
		created: parseIcalDate(getProperty(component, 'CREATED')),
		lastModified: parseIcalDate(getProperty(component, 'LAST-MODIFIED')),
		dtstamp: parseIcalDate(getProperty(component, 'DTSTAMP')),
		duration: getProperty(component, 'DURATION')?.value,
		geo: geo?.length === 2 && geo.every(Number.isFinite) ? { latitude: geo[0], longitude: geo[1] } : undefined,
		comments: getProperties(component, 'COMMENT').map((property) => property.value),
		contacts: getProperties(component, 'CONTACT').map((property) => property.value),
		resources: getProperties(component, 'RESOURCES').flatMap((property) =>
			splitIcalList(property.rawValue).map(unescapeIcalText),
		),
		relatedTo: getProperties(component, 'RELATED-TO'),
		requestStatus: getProperties(component, 'REQUEST-STATUS').map((property) => property.value),
		properties: component.properties,
		components: component.components,
		xProperties: component.properties.filter((property) =>
			property.name.startsWith('X-') || !knownNames.has(property.name),
		),
	};
}

export function parseIcalEvents(icalString: string): ParsedEvent[] {
	try {
		const document = parseIcalDocument(icalString);
		if (!document) return [];
		const events = document.name === 'VEVENT'
			? [document]
			: document.components.filter((component) => component.name === 'VEVENT');
		return events.map(parseEventComponent);
	} catch {
		return [];
	}
}

function parseIcal(icalString: string): ParsedEvent | null {
	return parseIcalEvents(icalString)[0] ?? null;
}

export function buildIcal(uid: string, options: CreateEventOptions): string {
	const now = formatUtcDate(new Date().toISOString());
	const event: IcalComponent = {
		name: 'VEVENT',
		properties: [
			makeProperty('UID', uid),
			makeProperty('DTSTAMP', now),
			makeProperty('CREATED', now),
			makeProperty('LAST-MODIFIED', now),
			makeDateProperty('DTSTART', options.start, options.allDay ?? false, options.timezone),
			makeDateProperty('DTEND', options.end, options.allDay ?? false, options.timezone),
			makeTextProperty('SUMMARY', options.summary),
		],
		components: [],
	};

	applyWritableFields(event, options, false);
	const document: IcalComponent = {
		name: 'VCALENDAR',
		properties: [
			makeProperty('VERSION', '2.0'),
			makeProperty('PRODID', '-//n8n-nodes-apple-icloud//EN'),
			makeProperty('CALSCALE', 'GREGORIAN'),
		],
		components: [event],
	};
	return serializeIcalComponent(document);
}

function escapeIcal(str: string): string {
	return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function makeProperty(
	name: string,
	rawValue: string,
	parameters: Record<string, string[]> = {},
): IcalProperty {
	return { name: name.toUpperCase(), value: unescapeIcalText(rawValue), rawValue, parameters };
}

function makeTextProperty(name: string, value: string): IcalProperty {
	return makeProperty(name, escapeIcal(value));
}

function formatUtcDate(date: string): string {
	return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function formatLocalDate(date: string): string {
	return date
		.replace(/Z$/, '')
		.replace(/[+-]\d{2}:\d{2}$/, '')
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

function makeDateProperty(name: string, date: string, allDay: boolean, timezone?: string): IcalProperty {
	if (allDay || /^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return makeProperty(name, date.replace(/-/g, '').slice(0, 8), { VALUE: ['DATE'] });
	}
	if (timezone) return makeProperty(name, formatLocalDate(date), { TZID: [timezone] });
	return makeProperty(name, formatUtcDate(date));
}

function participantProperty(name: 'ORGANIZER' | 'ATTENDEE', participant: CalendarParticipant): IcalProperty {
	const parameters: Record<string, string[]> = { ...(participant.parameters ?? {}) };
	if (participant.name) parameters.CN = [participant.name];
	if (participant.role) parameters.ROLE = [participant.role.toUpperCase()];
	if (participant.participationStatus) parameters.PARTSTAT = [participant.participationStatus.toUpperCase()];
	if (participant.rsvp !== undefined) parameters.RSVP = [participant.rsvp ? 'TRUE' : 'FALSE'];
	if (participant.userType) parameters.CUTYPE = [participant.userType.toUpperCase()];
	if (participant.delegatedTo?.length) parameters['DELEGATED-TO'] = participant.delegatedTo;
	if (participant.delegatedFrom?.length) parameters['DELEGATED-FROM'] = participant.delegatedFrom;
	if (participant.member?.length) parameters.MEMBER = participant.member;
	if (participant.directory) parameters.DIR = [participant.directory];
	if (participant.sentBy) parameters['SENT-BY'] = [participant.sentBy];
	if (participant.language) parameters.LANGUAGE = [participant.language];
	const uri = participant.uri || (participant.email ? `mailto:${participant.email}` : '');
	if (!uri) throw new Error(`${name} requires either uri or email`);
	return makeProperty(name, uri, parameters);
}

function replaceProperties(component: IcalComponent, name: string, properties: IcalProperty[]): void {
	const normalizedName = name.toUpperCase();
	const firstIndex = component.properties.findIndex((property) => property.name === normalizedName);
	component.properties = component.properties.filter((property) => property.name !== normalizedName);
	component.properties.splice(firstIndex === -1 ? component.properties.length : firstIndex, 0, ...properties);
}

function setOptionalTextProperty(component: IcalComponent, name: string, value: string | undefined): void {
	if (value === undefined) return;
	replaceProperties(component, name, value ? [makeTextProperty(name, value)] : []);
}

function normalizeProperty(property: IcalProperty): IcalProperty {
	const rawValue = property.rawValue ?? escapeIcal(property.value ?? '');
	return makeProperty(property.name, rawValue, property.parameters ?? {});
}

function normalizeComponent(component: IcalComponent): IcalComponent {
	return {
		name: component.name.toUpperCase(),
		properties: (component.properties ?? []).map(normalizeProperty),
		components: (component.components ?? []).map(normalizeComponent),
	};
}

function applyWritableFields(
	component: IcalComponent,
	fields: Partial<Omit<CreateEventOptions, 'calendarUrl'>>,
	preserveUnspecified: boolean,
): void {
	if (fields.summary !== undefined) replaceProperties(component, 'SUMMARY', [makeTextProperty('SUMMARY', fields.summary)]);
	setOptionalTextProperty(component, 'DESCRIPTION', fields.description);
	setOptionalTextProperty(component, 'LOCATION', fields.location);
	if (fields.url !== undefined) replaceProperties(component, 'URL', fields.url ? [makeProperty('URL', fields.url)] : []);
	if (fields.status !== undefined) replaceProperties(component, 'STATUS', fields.status ? [makeProperty('STATUS', fields.status.toUpperCase())] : []);
	if (fields.availability !== undefined) {
		replaceProperties(component, 'TRANSP', [makeProperty('TRANSP', fields.availability === 'free' ? 'TRANSPARENT' : 'OPAQUE')]);
	}
	if (fields.classification !== undefined) {
		replaceProperties(component, 'CLASS', fields.classification ? [makeProperty('CLASS', fields.classification.toUpperCase())] : []);
	}
	if (fields.priority !== undefined) replaceProperties(component, 'PRIORITY', [makeProperty('PRIORITY', String(fields.priority))]);
	if (fields.sequence !== undefined) replaceProperties(component, 'SEQUENCE', [makeProperty('SEQUENCE', String(fields.sequence))]);
	if (fields.geo !== undefined) {
		replaceProperties(component, 'GEO', fields.geo
			? [makeProperty('GEO', `${fields.geo.latitude};${fields.geo.longitude}`)]
			: []);
	}
	if (fields.organizer !== undefined) {
		replaceProperties(component, 'ORGANIZER', fields.organizer
			? [participantProperty('ORGANIZER', fields.organizer)]
			: []);
	}
	if (fields.attendees !== undefined) {
		replaceProperties(component, 'ATTENDEE', fields.attendees.map((attendee) => participantProperty('ATTENDEE', attendee)));
	}
	if (fields.recurrenceRules !== undefined) {
		replaceProperties(component, 'RRULE', fields.recurrenceRules.map((rule) => makeProperty('RRULE', rule)));
	}
	const recurrenceTimezone = fields.timezone ?? getProperty(component, 'DTSTART')?.parameters.TZID?.[0];
	if (fields.recurrenceDates !== undefined) {
		replaceProperties(component, 'RDATE', fields.recurrenceDates.map((date) => makeDateProperty('RDATE', date, false, recurrenceTimezone)));
	}
	if (fields.excludedDates !== undefined) {
		replaceProperties(component, 'EXDATE', fields.excludedDates.map((date) => makeDateProperty('EXDATE', date, false, recurrenceTimezone)));
	}
	if (fields.attachments !== undefined) {
		replaceProperties(component, 'ATTACH', fields.attachments.map((attachment) => {
			const parameters: Record<string, string[]> = { ...(attachment.parameters ?? {}) };
			if (attachment.formatType) parameters.FMTTYPE = [attachment.formatType];
			if (attachment.encoding) parameters.ENCODING = [attachment.encoding];
			if (attachment.valueType) parameters.VALUE = [attachment.valueType];
			return makeProperty('ATTACH', attachment.value, parameters);
		}));
	}
	if (fields.categories !== undefined) {
		replaceProperties(component, 'CATEGORIES', fields.categories.length
			? [makeProperty('CATEGORIES', fields.categories.map(escapeIcal).join(','))]
			: []);
	}
	if (fields.comments !== undefined) {
		replaceProperties(component, 'COMMENT', fields.comments.map((comment) => makeTextProperty('COMMENT', comment)));
	}
	if (fields.contacts !== undefined) {
		replaceProperties(component, 'CONTACT', fields.contacts.map((contact) => makeTextProperty('CONTACT', contact)));
	}
	if (fields.resources !== undefined) {
		replaceProperties(component, 'RESOURCES', fields.resources.length
			? [makeProperty('RESOURCES', fields.resources.map(escapeIcal).join(','))]
			: []);
	}
	if (fields.relatedTo !== undefined) replaceProperties(component, 'RELATED-TO', fields.relatedTo.map(normalizeProperty));
	if (fields.requestStatus !== undefined) {
		replaceProperties(component, 'REQUEST-STATUS', fields.requestStatus.map((status) => makeProperty('REQUEST-STATUS', status)));
	}
	if (fields.alarms !== undefined) {
		component.components = component.components.filter((child) => child.name !== 'VALARM');
		component.components.push(...fields.alarms.map(normalizeComponent));
	}
	if (fields.customProperties !== undefined) {
		const grouped = new Map<string, IcalProperty[]>();
		for (const property of fields.customProperties) {
			const normalized = normalizeProperty(property);
			grouped.set(normalized.name, [...(grouped.get(normalized.name) ?? []), normalized]);
		}
		for (const [name, properties] of grouped) replaceProperties(component, name, properties);
	}
	if (fields.customComponents !== undefined) {
		const customNames = new Set(fields.customComponents.map((child) => child.name.toUpperCase()));
		component.components = component.components.filter((child) => !customNames.has(child.name));
		component.components.push(...fields.customComponents.map(normalizeComponent));
	}
	if (!preserveUnspecified && fields.sequence === undefined) {
		replaceProperties(component, 'SEQUENCE', [makeProperty('SEQUENCE', '0')]);
	}
}

function quoteParameterValue(value: string): string {
	const escaped = value.replace(/(["\\])/g, '\\$1');
	return /[,:;]/.test(value) ? `"${escaped}"` : escaped;
}

function foldIcalLine(line: string): string {
	const chunks: string[] = [];
	let chunk = '';
	for (const character of line) {
		if (Buffer.byteLength(chunk + character, 'utf8') > 73) {
			chunks.push(chunk);
			chunk = character;
		} else {
			chunk += character;
		}
	}
	if (chunk || !chunks.length) chunks.push(chunk);
	return chunks.join('\r\n ');
}

function serializeProperty(property: IcalProperty): string {
	const parameters = Object.entries(property.parameters).map(([name, values]) =>
		`;${name.toUpperCase()}=${values.map(quoteParameterValue).join(',')}`,
	).join('');
	return foldIcalLine(`${property.name.toUpperCase()}${parameters}:${property.rawValue}`);
}

function serializeIcalComponent(component: IcalComponent): string {
	const lines = [
		`BEGIN:${component.name.toUpperCase()}`,
		...component.properties.map(serializeProperty),
		...component.components.map(serializeIcalComponent),
		`END:${component.name.toUpperCase()}`,
	];
	return lines.join('\r\n');
}

export function patchIcalEvent(
	icalString: string,
	uid: string,
	updates: Partial<Omit<CreateEventOptions, 'calendarUrl'>>,
): string {
	const document = parseIcalDocument(icalString);
	if (!document) throw new Error('Could not parse existing event');
	const candidates = document.name === 'VEVENT'
		? [document]
		: document.components.filter((component) => component.name === 'VEVENT');
	const matching = candidates.filter((component) => getProperty(component, 'UID')?.value === uid);
	const event = matching.find((component) => !getProperty(component, 'RECURRENCE-ID')) ?? matching[0];
	if (!event) throw new Error(`Event not found in calendar object: UID ${uid}`);

	if (updates.start !== undefined || updates.end !== undefined || updates.allDay !== undefined || updates.timezone !== undefined) {
		const parsed = parseEventComponent(event);
		const allDay = updates.allDay ?? parsed.allDay;
		const timezone = updates.timezone ?? parsed.timezone;
		const start = updates.start ?? parsed.start;
		const end = updates.end ?? parsed.end;
		if (!start || !end) throw new Error('Existing event is missing DTSTART or DTEND');
		if (new Date(end) <= new Date(start)) throw new Error('End date/time must be after start date/time');
		replaceProperties(event, 'DTSTART', [makeDateProperty('DTSTART', start, allDay, timezone)]);
		replaceProperties(event, 'DTEND', [makeDateProperty('DTEND', end, allDay, timezone)]);
	}

	applyWritableFields(event, updates, true);
	const previousSequence = Number(getProperty(event, 'SEQUENCE')?.value ?? '0');
	if (updates.sequence === undefined) {
		replaceProperties(event, 'SEQUENCE', [makeProperty('SEQUENCE', String(Number.isFinite(previousSequence) ? previousSequence + 1 : 1))]);
	}
	const now = formatUtcDate(new Date().toISOString());
	replaceProperties(event, 'DTSTAMP', [makeProperty('DTSTAMP', now)]);
	replaceProperties(event, 'LAST-MODIFIED', [makeProperty('LAST-MODIFIED', now)]);
	return serializeIcalComponent(document);
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
