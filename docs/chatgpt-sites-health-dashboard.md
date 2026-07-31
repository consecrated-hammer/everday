# ChatGPT Sites health dashboard hand-off

## Purpose

Everday exposes a versioned, read-only dashboard API for a private ChatGPT Site.
The Site must call Everday only from its server-side route. Do not send the
Everday token to browser code.

## Connection

```text
GET https://everday.batserver.au/api/v1/health/dashboard
Authorization: Bearer ${EVERDAY_API_TOKEN}
Accept: application/json
```

The endpoint accepts these optional query parameters:

| Parameter | Default | Range |
| --- | ---: | ---: |
| `weightDays` | 90 | 7 to 365 |
| `stepDays` | 30 | 7 to 365 |
| `daySummaryDays` | 14 | 7 to 90 |

The response includes `apiVersion`, `generatedAt`, the user timezone, goal,
targets, today, current-week values, weight history, step history, and daily
summaries. It deliberately excludes meal entries and free-text notes.

## Site implementation requirements

- Keep the Site private/owner-only using the platform’s built-in access control.
- Create a server-side `/api/health` route that calls the Everday endpoint with
  `Authorization: Bearer ${EVERDAY_API_TOKEN}`.
- Store `EVERDAY_API_BASE_URL=https://everday.batserver.au` as a normal
  environment variable and `EVERDAY_API_TOKEN` as a Site secret.
- Use an 8 to 10 second upstream timeout and `Cache-Control: no-store` on the
  browser response.
- Return a generic upstream failure to the browser. Never return the Everday
  token, upstream Authorization header, or raw authentication error.
- Show `generatedAt` as the dashboard’s refresh time and retain the last
  successful payload if a manual refresh fails.

## OAuth

OAuth is not required for version 1. The Site’s private viewer gate controls
who can open the Site; the separate Everday token identifies the single
read-only Everday account. Add OAuth only if the Site must support multiple
Everday users or delegated access.

## Operational commands

Run these inside the Everday container after the migration is deployed:

```bash
python scripts/api_tokens.py create --user <everday-username> --name chatgpt-sites-health-dashboard
python scripts/api_tokens.py list --user <everday-username>
python scripts/api_tokens.py revoke --user <everday-username> --token-id <token-id>
```

The create command displays the plaintext token once. Store it only in the
ChatGPT Site secret configuration. Revoke it immediately if exposed.

## Security boundary

The token is scoped only to `health:dashboard:read`, is stored by Everday as an
Argon2 hash plus a SHA-256 lookup hash, can be revoked immediately, and is
limited to 60 requests per token per hour. Existing Everday login, HAE import,
Health dashboard, and Health MCP authentication are independent and unchanged.
