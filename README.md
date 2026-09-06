# Accel IT Staff App

A read-only field app for Accel IT staff: clients, tickets, asset onboarding and
the address book, on a phone.

It makes **no backend changes**. Every endpoint it calls is one the Accel Online
web admin already calls — see [docs/api-contract.md](docs/api-contract.md) for
each one's exact shape, authorization and quirks.

## Requires the office VPN

The admin API is behind an IP allowlist, so the app only works from the office
network. Start the VPN before opening the app. If it is off, the app says so on
launch rather than showing a password box that cannot succeed, and a VPN drop
mid-session routes back to that screen rather than to a misleading login error.

## Running it

```bash
npm install
cp .env.example .env      # point EXPO_PUBLIC_API_URL at the admin host
npm start
```

`EXPO_PUBLIC_API_URL` must be the **admin** host (the one `APP_ADMIN_URL` names in
the backend). The client-portal host serves a different route set and will 404.

```bash
npm test        # unit tests for the pure helpers
npx expo-doctor # config and dependency check
```

## What it does not do

Nothing is created, edited or deleted anywhere in the app. It holds a
full-privilege admin token because that is the only kind the API mints — the
read-only property is the app's, not the token's.

The Accounts tab is sysadmin-only, because `GET /api/invoices` is gated on
`manage-client-account`, which resolves to `$user->sysadmin` and nothing else.

There is no "assigned to me" ticket filter, because the API has no parameter for
one. The backend already sorts your tickets first, and rows assigned to you are
marked.
