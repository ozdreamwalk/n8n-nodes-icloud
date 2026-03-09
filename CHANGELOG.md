# Changelog

All notable changes to `n8n-nodes-icloud` will be documented here.

## [2.0.7] - 2026-03-09

### Added

- **Email attachments** — `Send Email` now supports attaching binary files from upstream nodes (Read File, HTTP Request, Google Drive, etc.). Add one or more attachments via the new **Attachments** fixed-collection field; each item references a binary property name and an optional filename override.
- **iCloud Trigger node** — New polling trigger (`ICloudTrigger`) fires when new emails arrive in an IMAP mailbox. Uses UID-based deduplication (no duplicate triggers on polling overlap). Supports sender and subject filters. On first activation the current state is recorded silently; manual test runs return the most recent email for preview.

### Changed

- **Known Limitations updated** — Attachments and push-notification entries replaced with accurate current state.

---

## [2.0.6] - 2026-03-09

### Added

- **iCloud Mail Address credential field** (optional) — Users whose Apple ID is not an `@icloud.com` address (e.g. Gmail or custom domain) can now enter their `@icloud.com` / `@me.com` / `@mac.com` mail address separately. IMAP and SMTP use this address for authentication and as the `from` address when sending. Calendar and Contacts are unaffected (still use Apple ID). Falls back to Apple ID if left empty (fully backwards-compatible).

## [2.0.3] - 2026-03-06

### Fixed

- **vCard item-prefix parsing** — iCloud writes `item1.EMAIL`, `item2.TEL`, `item1.ADR` instead of plain `EMAIL`/`TEL`/`ADR`. Contacts now correctly return `emails` and `phones` arrays (previously always empty for iCloud contacts).
- **TRANSP default (RFC 5545 §3.8.2.7)** — Timed events without an explicit `TRANSP` field now correctly return `availability: "busy"` instead of `undefined`. All-day events remain `undefined`.
- **createEvent validation** — End date/time before or equal to start now throws `Error: End date/time must be after start date/time`.
- **createEvent response** — Now returns `uid` and `url` in addition to `etag`, `summary`, `start`, `end`.
- **updateEvent / deleteEvent** — No longer require the full event URL. Now accept **Calendar** (dropdown from `Get Calendars`) + **Event UID** (from `Get Events` or `Create Event`). Internal helper tries direct URL `{calendarUrl}{uid}.ics` first, falls back to full-calendar scan.
- **updateContact / deleteContact** — No longer require the full contact URL. Now accept **Contact UID** (from `Get Contacts` or `Create Contact`). Internal helper scans all address books.
- **Mail Mailbox field** — Changed from `loadOptionsMethod: getMailboxOptions` (triggered IMAP connection on form load, causing "Command failed") to a free `string` field with default `INBOX` and hint for common mailbox names.

## [2.0.0] - 2026-03-06

### Added
- **Mail resource**
  - `sendEmail` — SMTP via `smtp.mail.me.com:587` (STARTTLS), supports To/CC/BCC/HTML
  - `getEmails` — IMAP via `imap.mail.me.com:993` (SSL), with filters (from, subject, unread, since)
  - `getEmailById` — Retrieve single email by IMAP UID including full body
  - `moveEmail` — Move email between IMAP mailboxes
  - `deleteEmail` — Permanently delete email by UID
- **Calendar resource**
  - `getCalendars` — List all calendars with URL, display name, color
  - `getEvents` — Retrieve events with optional date range filter
  - `createEvent` — Create event with summary, start/end, description, location, all-day flag
  - `updateEvent` — Update existing event fields by URL
  - `deleteEvent` — Delete event by URL
- **Contacts resource**
  - `getContacts` — List all contacts, optional search query
  - `createContact` — Create vCard 3.0 contact (name, email, phone, notes)
  - `updateContact` — Update contact fields by URL
  - `deleteContact` — Delete contact by URL
- `usableAsTool: true` — Full AI Agent tool support
- CalDAV/CardDAV server auto-discovery via tsdav PROPFIND
- `continueOnFail` support per item

### Changed
- Package renamed from `n8n-nodes-apple-icloud` to `n8n-nodes-icloud`
- Author changed to OzDreamWalk (`n8n-node-dev@ozdreamwalk.com`)
- Repository moved to `github.com/ozdreamwalk/n8n-nodes-icloud`
- Version bumped to 2.0.0 (major — full iCloud integration, was Calendar-only)

### Migration from v0.2.7

| What changed | Old (`n8n-nodes-apple-icloud`) | New (`n8n-nodes-icloud`) |
|---|---|---|
| Package name | `n8n-nodes-apple-icloud` | `n8n-nodes-icloud` |
| Resources | Calendar only | Mail + Calendar + Contacts |
| Credentials | Apple iCloud Credentials | Apple iCloud Credentials (same fields) |
| n8n install | `n8n-nodes-apple-icloud` | `n8n-nodes-icloud` |

Calendar workflows created with v0.2.7 are fully compatible with v2.0.0.
