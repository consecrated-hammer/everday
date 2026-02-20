# iOS Auth Process (Everday)

This document describes the current backend auth flow for iOS integration work.

## Base URL

- Dev: `https://everday-dev.batserver.au/api`
- Prod: `https://everday.batserver.au/api`

All endpoints below are relative to `/api`.

## Auth Lifecycle

1. Register request (optional): `POST /auth/register`
2. Parent approval in Settings: `PUT /settings/users/{user_id}/approve`
3. Login: `POST /auth/login`
4. Use bearer token on protected endpoints
5. Refresh token rotation: `POST /auth/refresh`
6. Logout (revoke refresh token): `POST /auth/logout`

## Approval-Gated Registration

`POST /auth/register`

Request body:

```json
{
  "Username": "newkid",
  "Password": "Passw0rd!123",
  "FirstName": "New",
  "LastName": "Kid",
  "Email": "newkid@example.com",
  "DiscordHandle": "newkid#1234"
}
```

Success response:

```json
{
  "Status": "PendingApproval",
  "Message": "Account request submitted. A parent must approve this account before sign in."
}
```

Notes:

- New registrations are created as `Role=Kid` and `IsApproved=false`.
- Parent users receive a notification: title `Account approval requested`, link `/settings/users`.
- Until approved, login and refresh return `403` with:
  - `Account pending approval. A parent must approve this account before sign in.`

## Login

`POST /auth/login`

Request body:

```json
{
  "Username": "newkid",
  "Password": "Passw0rd!123"
}
```

Success response:

```json
{
  "AccessToken": "jwt...",
  "RefreshToken": "opaque...",
  "TokenType": "bearer",
  "ExpiresIn": 1800,
  "Username": "newkid",
  "RequirePasswordChange": false,
  "Role": "Kid",
  "FirstName": "New",
  "LastName": "Kid",
  "Email": "newkid@example.com",
  "DiscordHandle": "newkid#1234"
}
```

## Refresh (Rotating)

`POST /auth/refresh`

Request body:

```json
{
  "RefreshToken": "opaque..."
}
```

Behavior:

- Valid refresh token is consumed (revoked).
- New access + refresh tokens are returned.
- Store the newly returned refresh token immediately.

## Logout

`POST /auth/logout`

Request body:

```json
{
  "RefreshToken": "opaque..."
}
```

Headers:

- `Authorization: Bearer <AccessToken>`

Behavior:

- Matching refresh token is revoked.
- Client should clear local auth state regardless of API error.

## Password Reset

- Start reset: `POST /auth/forgot` with `{ "Identifier": "<username-or-email>" }`
- Complete reset: `POST /auth/reset-password` with `{ "Token": "...", "NewPassword": "..." }`

## Parent Approval Endpoint

`PUT /settings/users/{user_id}/approve`

Headers:

- `Authorization: Bearer <AccessToken>` (must be Parent role with settings write access)

Behavior:

- Sets `IsApproved=true`, `ApprovedAt`, and `ApprovedByUserId`.
- Pending user can then login normally.

## Recommended iOS Models

```swift
struct LoginRequest: Encodable {
    let Username: String
    let Password: String
}

struct RefreshRequest: Encodable {
    let RefreshToken: String
}

struct RegisterRequest: Encodable {
    let Username: String
    let Password: String
    let FirstName: String?
    let LastName: String?
    let Email: String?
    let DiscordHandle: String?
}

struct TokenResponse: Decodable {
    let AccessToken: String
    let RefreshToken: String
    let TokenType: String
    let ExpiresIn: Int
    let Username: String
    let RequirePasswordChange: Bool
    let Role: String
    let FirstName: String?
    let LastName: String?
    let Email: String?
    let DiscordHandle: String?
}
```

## iOS Storage Guidance

- Store `AccessToken` and `RefreshToken` in Keychain.
- Keep profile fields in memory or app storage for UI display.
- On app launch:
  - if refresh token exists, call `/auth/refresh`;
  - if refresh fails (401/403), clear auth and show login.

## Common Error Handling

- `400`: validation error (show message from `detail`)
- `401`: invalid credentials/token (force re-auth)
- `403`: approval pending or access denied
- `404`: resource not found (for admin/settings actions)
- `409`: username already exists

