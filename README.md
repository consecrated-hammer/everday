# Everday

## Alexa Skill (self-hosted)

### Setup
- Run backend migrations so the shopping schema is created.
- Create or choose a service user and grant them the `shopping` module role (`Parent`).
- Configure the Alexa endpoint to `https://everday.batserver.au/api/alexa` and keep the reverse proxy forwarding raw body + headers.

### Env vars
- `ALEXA_ENABLED` (true|false)
- `ALEXA_HOUSEHOLD_ID` (int)
- `ALEXA_SERVICE_USER_ID` (int)
- `ALEXA_SKILL_ID` (string)
- `ALEXA_READ_LIMIT` (int, default 10)
- `ALEXA_VERIFY_SIGNATURE` (true|false, forced true in production)
- `ALEXA_VERIFY_TIMESTAMP` (true|false, forced true in production)
- `ALEXA_MAX_BODY_BYTES` (int, default 262144)
- `ALEXA_RATE_LIMIT_REQUESTS` (int, default 30)
- `ALEXA_RATE_LIMIT_WINDOW_SECONDS` (int, default 60)

### Example phrases
- "Alexa, tell Everday add milk"
- "Alexa, ask Everday what is on my list"
