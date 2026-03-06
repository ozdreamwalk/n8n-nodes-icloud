# Changelog

All notable changes to `n8n-nodes-icloud` will be documented here.

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
