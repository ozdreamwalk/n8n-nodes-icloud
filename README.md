# n8n-nodes-icloud

[![npm version](https://img.shields.io/npm/v/n8n-nodes-icloud.svg)](https://www.npmjs.com/package/n8n-nodes-icloud)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20the%20Project-orange?logo=buy-me-a-coffee)](https://buymeacoffee.com/ozdreamwalk)

An **n8n community node** for integrating Apple iCloud into your workflows — Mail, Calendar, and Contacts, with full AI Agent tool support.

---

## Features

| Resource | Operations | Protocol |
|----------|-----------|----------|
| **Mail** | Send, Get Emails, Get by ID, Move, Delete | SMTP / IMAP |
| **Calendar** | List Calendars, Get Events, Create, Update, Delete | CalDAV |
| **Contacts** | Get Contacts, Create, Update, Delete | CardDAV |

- `usableAsTool: true` — Works as an AI Agent tool in n8n
- Supports filtering emails by sender, subject, read status, date
- CalDAV auto-discovery (handles `p01-caldav.icloud.com`, `p02-...`, etc.)
- Full-day event support
- vCard 3.0 contact management

---

## Prerequisites

1. **Two-Factor Authentication** must be enabled on your Apple ID
2. **App-Specific Password** required — your regular Apple ID password will not work

### Generating an App-Specific Password

1. Sign in at [appleid.apple.com](https://appleid.apple.com)
2. Go to **Sign-In and Security → App-Specific Passwords**
3. Click **Generate an app-specific password**
4. Enter a label (e.g., "n8n iCloud Integration")
5. Copy the generated password (format: `xxxx-xxxx-xxxx-xxxx`)

---

## Installation

### Via n8n Community Nodes UI

1. Open your n8n instance → **Settings → Community Nodes**
2. Click **Install**
3. Enter: `n8n-nodes-icloud`
4. Click **Install**

### Manual Installation

```bash
npm install n8n-nodes-icloud
```

Or via Docker:

```bash
docker exec <container> npm install --prefix /home/node/.n8n/nodes n8n-nodes-icloud
docker restart <container>
```

### For AI Agent Tool Usage

Set this environment variable on your n8n instance:

```
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

---

## Credentials Setup

In n8n, add new credentials of type **"Apple iCloud Credentials"**:

| Field | Description |
|-------|-------------|
| **Apple ID** | Your Apple ID email (e.g., `yourname@icloud.com`) |
| **App-Specific Password** | The generated app-specific password (`xxxx-xxxx-xxxx-xxxx`) |

---

## Operations Reference

### Mail

#### Send Email
Sends an email via iCloud Mail SMTP (`smtp.mail.me.com:587`, STARTTLS).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| To | string | Yes | Recipient email(s), comma-separated |
| Subject | string | Yes | Email subject |
| Body | string | Yes | Email body |
| CC | string | No | Carbon copy recipient(s) |
| BCC | string | No | Blind carbon copy |
| Send as HTML | boolean | No | Treat body as HTML |

#### Get Emails
Retrieves emails from an IMAP mailbox (`imap.mail.me.com:993`, SSL).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Mailbox | string | INBOX | Folder name. Common iCloud mailboxes: `INBOX`, `Sent Messages`, `Drafts`, `Deleted Messages`, `Junk` |
| Limit | number | 10 | Max emails to return (newest first) |
| From | string | — | Filter by sender |
| Subject Contains | string | — | Filter by subject |
| Only Unread | boolean | false | Return only unread emails |
| Since | dateTime | — | Return emails after this date |

#### Get Email by ID
Retrieves a single email by its IMAP UID (includes full body).

#### Move Email
Moves an email from one mailbox to another.

#### Delete Email
Permanently deletes an email by UID.

---

### Calendar

#### Get Calendars
Returns all calendars with their URLs, display names, and colors.

#### Get Events
Retrieves events from one or all calendars, optionally filtered by date range.

| Parameter | Type | Description |
|-----------|------|-------------|
| Calendar URL | string | Optional — leave empty for all calendars |
| Start | dateTime | Optional filter: events after this date |
| End | dateTime | Optional filter: events before this date |

#### Create Event

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Calendar | options | Yes | Target calendar (dropdown from Get Calendars) |
| Summary | string | Yes | Event title |
| Start | dateTime | Yes | Start date/time |
| End | dateTime | Yes | End date/time (must be after Start) |
| Description | string | No | Event notes |
| Location | string | No | Event location |
| All Day Event | boolean | No | Full-day event flag |
| Timezone | string | No | IANA timezone (e.g. `Europe/Berlin`). Leave empty for UTC. |

Returns: `{ success, uid, url, etag, summary, start, end }`

#### Update Event
Updates fields on an existing event. Requires **Calendar** (dropdown) + **Event UID** (returned as `uid` by Get Events or Create Event).

#### Delete Event
Deletes an event. Requires **Calendar** (dropdown) + **Event UID**.

---

### Contacts

#### Get Contacts
Returns all contacts, with optional search filtering by name or email.

#### Create Contact

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| First Name | string | Yes | Contact's first name |
| Last Name | string | No | Contact's last name |
| Email | string | No | Email address |
| Phone | string | No | Phone number |
| Notes | string | No | Additional notes |

#### Update Contact
Updates fields on an existing contact. Requires **Contact UID** (returned as `uid` by Get Contacts or Create Contact).

#### Delete Contact
Deletes a contact. Requires **Contact UID**.

---

## AI Agent Usage

This node has `usableAsTool: true`, so it works directly as a tool in n8n AI Agent workflows.

**Example prompts:**
- *"Check my iCloud inbox and summarize unread emails from the last 24 hours"*
- *"Create a calendar event 'Team Meeting' tomorrow at 2pm to 3pm"*
- *"Find the contact John Doe and return his phone number"*
- *"Move all emails from newsletter@example.com to the Archive folder"*

**Setup:**
1. Add an **AI Agent** node to your workflow
2. Connect a language model (e.g., Claude, GPT-4)
3. In the **Tools** section, add the **iCloud** node
4. Configure credentials — the agent uses them for all tool calls

---

## Migration from v0.2.7

If you were using the old `n8n-nodes-apple-icloud` package (Calendar-only):

1. Uninstall the old package via n8n Community Nodes UI or manually
2. Install `n8n-nodes-icloud` (this package)
3. Re-create your iCloud credentials (same fields — Apple ID + App-Specific Password)
4. Calendar workflows remain compatible; Mail and Contacts are new additions

---

## Server Endpoints

| Protocol | Host | Port | Security |
|----------|------|------|----------|
| SMTP | `smtp.mail.me.com` | 587 | STARTTLS |
| IMAP | `imap.mail.me.com` | 993 | SSL/TLS |
| CalDAV | `caldav.icloud.com` | 443 | HTTPS (auto-discovery) |
| CardDAV | `contacts.icloud.com` | 443 | HTTPS (auto-discovery) |

> **Note:** CalDAV and CardDAV use account-specific server endpoints (`p01-caldav.icloud.com`, `p02-...`). The `tsdav` library handles server discovery automatically via PROPFIND.

---

## Known Limitations

- **No OAuth2** — Apple does not offer OAuth2 for third-party IMAP/SMTP/DAV access. App-Specific Passwords are the only supported method.
- **Attachments** — Sending attachments is not yet supported in v2.0.0.
- **Push notifications** — The node is pull-based only; there is no trigger/webhook for incoming mail or calendar changes.
- **iCloud+ / Hide My Email** — Alias addresses work normally as long as they are active in your Apple ID settings.
- **Shared calendars** — Read access to shared calendars should work; write access depends on the sharing permissions set by the calendar owner.

---

## Troubleshooting

**Authentication errors (`Invalid credentials` / `535`):**
- Ensure Two-Factor Authentication is active on your Apple ID
- Use an App-Specific Password, not your regular Apple ID password
- Verify the password has not been revoked at appleid.apple.com

**IMAP connection errors:**
- Verify iCloud Mail is enabled under [iCloud settings](https://www.icloud.com/settings/)
- Check that IMAP access is enabled in iCloud Mail settings

**CalDAV/CardDAV errors (`403 Forbidden`):**
- Ensure iCloud Calendar / Contacts sync is enabled in your Apple ID settings
- Auto-discovery requires a valid Apple ID with active iCloud services

**Node not appearing in n8n:**
- Restart n8n after installation
- Confirm `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` is set if using as AI tool
- Check n8n logs for loading errors

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `nodemailer` | ^6.9.0 | SMTP email sending |
| `imapflow` | ^1.0.170 | IMAP email retrieval |
| `tsdav` | ^2.1.6 | CalDAV / CardDAV (Calendar + Contacts) |

---

## License

MIT — see [LICENSE](LICENSE)

---

## Author

**OzDreamWalk** — [ozdreamwalk.com](https://ozdreamwalk.com)

<p><a href="https://buymeacoffee.com/ozdreamwalk"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20the%20Project-orange?logo=buy-me-a-coffee" alt="Buy Me a Coffee"></a></p>

---

## Links

- [npm Package](https://www.npmjs.com/package/n8n-nodes-icloud)
- [GitHub Repository](https://github.com/ozdreamwalk/n8n-nodes-icloud)
- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Apple App-Specific Passwords](https://support.apple.com/en-us/102654)
- [iCloud Mail SMTP/IMAP Settings](https://support.apple.com/en-us/103232)
- [Apple CalDAV Setup Guide](https://support.apple.com/en-us/102525)
