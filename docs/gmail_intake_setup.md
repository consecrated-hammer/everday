# Gmail intake setup (Life Admin documents)

This guide configures a dedicated Gmail mailbox that feeds the Everday Documents Library (stored locally), using the Gmail API + OAuth to pull attachments into **Unfiled**, then label emails as **Processed**.

## 0) Create the intake mailbox (Gmail)
1. Create a dedicated Gmail account (example: everdayintake@gmail.com).
2. Turn on 2-Step Verification for the account.
3. In Gmail, create these labels (left sidebar -> **More** -> **Create new label**):
   - `Everday`
   - `Everday/Processed`

Notes:
- Gmail dots in the username are ignored (for example `ever.day.intake` equals `everdayintake`).
- Plus addressing works for routing (for example `everdayintake+tax@gmail.com`) and is useful for filters.

## 1) Create the Google Cloud project
1. Go to Google Cloud Console -> create or select a project for Everday.
2. Enable the **Gmail API**.
3. Configure the OAuth consent screen:
   - User type: External (typical for a consumer Gmail inbox).
   - App name: `Everday`
   - User support email: your email.
   - Add yourself as a **test user** while the app is in testing.

## 2) Choose OAuth scopes (be explicit)
Everday needs to:
- Read message metadata and full content (to access attachments).
- Modify labels (move email from "Everday" to "Everday/Processed", optionally remove `UNREAD`).

### Recommended (single scope)
Use this scope if Everday will apply/remove labels after processing:
- `https://www.googleapis.com/auth/gmail.modify`

### Minimal (if you do NOT label as processed)
Use this scope only if Everday will *not* change labels or message state:
- `https://www.googleapis.com/auth/gmail.readonly`

### Optional (only if Everday creates labels itself)
If you want Everday to create labels via API rather than manually in Gmail:
- `https://www.googleapis.com/auth/gmail.labels`

Note:
- If you use `gmail.modify`, you can typically avoid `gmail.labels` by creating labels manually in the Gmail UI (simpler).

## 3) Create OAuth credentials (Web application)
Create a client for the web app OAuth flow.

1. Google Cloud Console -> APIs & Services -> Credentials -> **Create Credentials** -> **OAuth client ID**
2. Application type: **Web application**
3. Add these redirect URIs:
   - `https://everday.batserver.au/api/integrations/gmail/oauth/callback`
   - `https://everday-dev.batserver.au/api/integrations/gmail/oauth/callback`
4. Note the **Client ID** and **Client Secret**.

## 4) Connect Gmail inside Everday
Use the Settings UI to complete OAuth and store the refresh token in the DB.

1. Go to **Settings -> Integrations -> Gmail Intake**.
2. Click **Authenticate with Gmail**.
3. Complete the Google OAuth flow.

Notes:
- Everday stores the refresh token in the database. You never need to copy it manually.
- If Google does not return a refresh token, revoke access in Google and try again.

## 5) Configure Gmail routing (label-based intake)
Set up a Gmail filter so only intended mail enters the intake pipeline.

In Gmail -> Settings -> Filters and Blocked Addresses -> Create a new filter:
- **To**: your intake address (and optionally plus aliases)
- Optional: `has:attachment`

Filter actions:
- Apply the label: `Everday`
- Mark as read (optional)
- Skip the Inbox (optional)

Everday will:
- Pull messages with label `Everday`
- Create documents in **Unfiled**
- Apply label `Everday/Processed` (and optionally remove `Everday`) via API

## 6) Add env vars
Set these in `.env.dev` (and prod env when ready):

```dotenv
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=

# Optional: override user id for API calls (defaults to "me")
GMAIL_USER_EMAIL=

GMAIL_INBOX_LABEL=Everday
GMAIL_PROCESSED_LABEL=Everday/Processed

# Optional: narrow processing further using Gmail search syntax
# Example: only emails with attachments that are not already processed
GMAIL_INTAKE_QUERY=has:attachment
```
