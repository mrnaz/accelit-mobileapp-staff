# Accel IT Staff App

A read-only field app for Accel IT staff: clients, tickets, asset onboarding and
the address book, on a phone.

It needs one backend change, to sign-in and token lifetimes (in `accelit`; see
[the design](docs/superpowers/specs/2026-09-30-app-sign-in-biometric-unlock-design.md)).
Every endpoint it calls is one the Accel Online web admin already calls — see
[docs/api-contract.md](docs/api-contract.md) for each one's exact shape,
authorization and quirks.

## Requires the office VPN

The admin API is behind an IP allowlist, so the app only works from the office
network. Start the VPN before opening the app. If it is off, the app says so on
launch rather than showing a password box that cannot succeed, and a VPN drop
mid-session routes back to that screen rather than to a misleading login error.

Login is the web app's login. The app calls the same `/login-ip-check`,
`/login` and `/check-otp` routes, which sit inside the same `ip.whitelist`
group as every other admin route, and it goes through the same MFA: an OTP
token that can only exchange a code, then a full token, with the same
three-week remembered device sent as `X-MFA-Device-Token`. There is no
app-specific route that skips either check.

## Sign in once, then Face ID

The app sends `X-Accel-Client: staff-app` with every request. On `/login` and
`/check-otp` that gets it its own kind of token, so signing in on the phone no
longer signs you out of the web admin, or the other way round. Each kind still
has one session per person: signing in on a second phone ends the first
phone's session.

After a full sign-in the app's token lasts a year. On a phone with Face ID or a
fingerprint enrolled it is kept in the Keychain / Keystore with
`requireAuthentication`, so the OS hands it back only after a biometric match:

- the app asks on every launch, and on return after 5+ minutes away;
- adding or removing a face or fingerprint makes the stored token unreadable,
  and the next open asks for the password;
- "Sign in with password" is always on the unlock screen.

A phone with no biometric enrolled keeps the token in memory only: the password
again on every launch and after 5+ minutes away. The login form remembers the
last email either way.

The Android contact-sync worker runs with no biometric check, so it is given a
second token that can only call `GET /api/address-book`.

## Passwords are displayed, never stored

Client passwords and local-admin passwords are shown on request and discarded.
The app never writes one anywhere on the device:

- Nothing password-shaped goes into AsyncStorage. The session token is in the
  Keychain / Keystore behind a biometric check, never in AsyncStorage. What
  AsyncStorage holds: the remembered-device token, the last sign-in email, a
  session marker with the token's expiry and nothing secret, the theme, and the
  staff profile with its TOTP seed stripped.
- There is no copy button and the revealed text is not selectable, so a
  password cannot reach the clipboard, which outlives the app, is readable by
  other apps and syncs between Apple devices.
- A revealed password is masked again the moment the app leaves the
  foreground, so it is not in the app-switcher snapshot the OS writes to disk.
- The values live only in the state of the tab or screen showing them and go
  when that unmounts.

One thing the app cannot control: iOS keeps an HTTP cache, and the API answers
with `Cache-Control: no-cache, private`, which permits storing the body. Adding
`cache.headers:no_store` to the passwords and asset-onboarding routes in the
backend closes that; it is a backend change.

## Running it

```bash
npm install
cp .env.example .env      # point EXPO_PUBLIC_API_URL at the admin host
npm start
```

`EXPO_PUBLIC_API_URL` must be the **admin** host (the one `APP_ADMIN_URL` names in
the backend). The client-portal host serves a different route set and will 404.

On a real phone it has to be a host the phone can resolve over the VPN — the
staging or production host. A local `.test` domain only resolves on the machine
running Valet, and substituting that machine's LAN IP 404s, because the API's
routes are bound to the admin domain and would see the wrong `Host` header. A
simulator running on the same Mac can use the `.test` domain.

```bash
npm test        # unit tests for the pure helpers, plus the root layout (jsdom)
npx expo-doctor # config and dependency check
```

Biometric unlock needs a development or EAS build, because
`expo-secure-store` and `expo-local-authentication` are native modules that
Expo Go lacks. It also needs a real phone: simulators and emulators do not
enforce the biometric check. The checklist is
[docs/biometric-unlock-verification.md](docs/biometric-unlock-verification.md).
On web (the Chrome harness) there is no lock; the token is kept in AsyncStorage
as before.

## Screens

Every screen follows the UX handoff in `docs/superpowers/plans/2026-09-06-ux-redesign.md`
(the plan quotes the handoff's values verbatim). Two deliberate departures from
that handoff, both on the product owner's instruction: there is no copy button
for a password anywhere in the app, and ticket rows keep their age in days
after the reference, `#51870  (24d)`.

## What it does not do

Nothing is created, edited or deleted anywhere in the app. It holds a
full-privilege admin token because the API mints no read-only kind — the
read-only property is the app's, not the token's. The one narrower token is the
contact-sync worker's, which can read the address book and nothing else.

The Accounts tab is sysadmin-only, because `GET /api/invoices` is gated on
`manage-client-account`, which resolves to `$user->sysadmin` and nothing else.

There is no "assigned to me" ticket filter, because the API has no parameter for
one. The backend already sorts your tickets first, and rows assigned to you are
marked.
