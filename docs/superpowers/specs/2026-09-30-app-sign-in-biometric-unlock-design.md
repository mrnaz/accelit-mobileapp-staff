# App sign-in: separate sessions and biometric unlock — design

Date: 2026-09-30
Status: awaiting review

## Goal

Three complaints from the ticket "Mobile App Login / Auth issues":

1. The login screen must remember the username.
2. Signing in to the app must not sign the user out of the web admin, and the
   reverse.
3. Typing a long password on every open makes the app unusable. After one full
   sign-in the app keeps a token (never the password) and opening the app asks
   for Face ID or a fingerprint. With no biometric enrolled on the phone, it
   falls back to the password.

## Decisions taken

| Question | Decision |
|---|---|
| Backend changes | Yes, in `accelit`. Items 2 and 3 cannot be done app-side. |
| App session lifetime | 30 days from the full sign-in, fixed. Then password (+ MFA) again. |
| When the app locks | Every cold start, and on return after 5+ minutes in the background. |
| How the lock is enforced | The token is stored with `expo-secure-store`'s `requireAuthentication`, so the OS releases it only after a biometric match. |
| Biometrics changed on the phone | The stored token becomes unreadable; the app clears it and asks for the password. |
| No biometric enrolled | Token held in memory only. Cold start or 5+ minutes away means the password again. |
| "Fall back to password" | The Accel password (full sign-in), not the phone's PIN. |
| MFA | Unchanged. It applies to every full sign-in, with the existing three-week remembered device. |
| Contact sync worker | Gets its own token that can only call `GET /api/address-book`. The full token never leaves the biometric lock. |
| Several phones | One app session per staff member: an app sign-in on a second phone ends the first phone's app session. |
| Web admin | Keeps its single-session rule (the Edge token-sync fix) among web sessions only. |
| Expo web (dev harness) | Keeps today's AsyncStorage behaviour with no lock. Development only. |

## Constraints found

- `AuthHelper::revokeOtherSessions()` (`accelit/app/Helpers/AuthHelper.php`)
  deletes every token the staff member holds, and `AuthController` calls it on
  every successful login: the no-MFA and trusted-device branches of `login()`
  and both branches of `checkOTP()`. The app calls the same routes, so each
  login ends the other. It was added on 2026-07-10 because MS Edge syncs
  tokens between browsers.
- `config('sanctum.expiration') = 600`: every token dies 600 minutes after it
  was created, and there is no refresh. Sanctum 3.3.3 checks both that
  `created_at` window and the per-token `expires_at`, so a longer `expires_at`
  alone would not help.
- `sanctum:prune-expired --hours=24` is scheduled (`app/Console/Kernel.php`).
  With `expiration` set it deletes by `created_at`; with it `null` it deletes
  only by `expires_at`.
- `personal_access_tokens.expires_at` exists and is `null` on every row today.
- `EnsureTokenCan` (`token.can:<ability>`) calls `tokenCan()`, and Sanctum's
  `can()` passes any token whose abilities include `*`.
- The app keeps its token in AsyncStorage (`app/services/api.js`,
  `app/utils/authFlow.js`) and hands a copy to the Android contact worker,
  which stores it in plain private prefs. The contact-sync spec justified that
  because the same token already sat in AsyncStorage. After this change it no
  longer would.
- The accel-contacts config plugin already sets `android:allowBackup="false"`
  and its own `dataExtractionRules`.
- `expo-secure-store` with `requireAuthentication`:
  - iOS uses `biometryCurrentSet`, and prompts on read but not on create.
  - Android uses `setUserAuthenticationRequired(true)` and prompts on write
    as well as read. That needs class-3 (strong) biometrics, so on most
    Android phones that means fingerprint, not face unlock.
  - Adding or removing a face or fingerprint makes the item unreadable.
  - Emulators and simulators do not enforce the prompt.
- Both `expo-secure-store` and `expo-local-authentication` are native modules,
  so they need a new binary and cannot ship by OTA update.

## Backend (`accelit`)

### Telling the app apart

The app sends `X-Accel-Client: staff-app` on every request. Only `login()` and
`checkOTP()` in `App\Http\Controllers\AuthController` read it. There is no
security weight on the header: an app session still needs the password, MFA
and the IP allowlist, exactly as a web session does.

### Token kinds

| Name | Minted for | Abilities | Expires |
|---|---|---|---|
| `auth_token` | web sign-in (no header), impersonation | `*` | 600 min (default) |
| `staff_app` | app sign-in | `*` | 30 days |
| `staff_app_contacts` | app sign-in, paired with `staff_app` | `address-book` | 30 days |
| `token` | OTP stub, both clients | `otp` | 600 min (default) |

A new `AuthHelper::issueSessionTokens(Staff $user, Request $request): array`
replaces the four `revokeOtherSessions()` + `createToken('auth_token')` pairs in
the staff `AuthController`:

- **No header (web):**
  - delete the user's `auth_token` tokens;
  - create one `auth_token`;
  - return `['token' => ...]`.
- **Header present (app):**
  - delete the user's `staff_app` and `staff_app_contacts` tokens;
  - create one of each, both with `expires_at = now()->addDays(30)`;
  - return `['token' => ..., 'contacts_token' => ..., 'expires_at' => <ISO 8601>]`.

The controller merges that array into its existing response. Web responses are
unchanged. `revokeOtherSessions()` stays, because the client-portal
`Client\AuthController` still uses it, and that controller is not touched.

The lifetimes live in `config/sanctum.php` as `default_token_minutes => 600`
and `staff_app_token_days => 30`.

### Expiry

- `sanctum.expiration` becomes `null`.
- `AppServiceProvider::boot()` registers a `creating` listener on
  `Laravel\Sanctum\PersonalAccessToken` that sets
  `expires_at ??= now()->addMinutes(config('sanctum.default_token_minutes'))`.
  Every existing `createToken()` call therefore keeps its 600-minute lifetime
  with no edit: staff web, impersonation, OTP stub, client portal.
- A data migration sets `expires_at = created_at + 600 minutes` on every row
  where `expires_at` is `null`, so no token issued before the deploy becomes
  immortal.
- The scheduled `sanctum:prune-expired --hours=24` now prunes by `expires_at`
  alone and needs no change.

### Address book route

`GET /api/address-book` moves out of the `['auth:sanctum', 'token.can:*']`
group and gets its own `['auth:sanctum', 'token.can:address-book']`.

- Full tokens still pass, so the web admin is unaffected.
- The contacts token passes this route and gets a 403 everywhere else.
- An OTP stub still gets `EnsureTokenCan`'s 401 "OTP required.", as before.

### Logout

`POST /logout` still deletes the current token. When that token is named
`staff_app`, it also deletes the user's `staff_app_contacts` tokens.
Deactivating a staff member (`StaffRepository::setActive(false)`) already
deletes every token, app ones included.

## App (`accelit-staffapp`)

### Session module — `app/services/session.js` (new)

This module owns persistence. `api.js` keeps the token in memory only, and
`api.restore()` is removed. What is stored where:

| Where | Key | Holds |
|---|---|---|
| SecureStore, `requireAuthentication: true` | `staffAppSession` | the `staff_app` token |
| AsyncStorage | `sessionMarker` | `{ expiresAt }`: says a locked session exists without triggering a prompt |
| AsyncStorage | `lastEmail` | the email of the last successful full sign-in |
| AsyncStorage | `mfaDeviceToken` | unchanged |

**Biometrics usable.** `LocalAuthentication.getEnrolledLevelAsync()` returns
`SecurityLevel.BIOMETRIC_STRONG` and `SecureStore.canUseBiometricAuthentication()`
is `true`. Anything less counts as "no biometric enrolled".

**Unlock label.** Worded from `supportedAuthenticationTypesAsync()`:

| Platform | Type | Label |
|---|---|---|
| iOS | facial | Face ID |
| iOS | fingerprint | Touch ID |
| Android | fingerprint | fingerprint |
| any | anything else | biometrics |

The module's functions:

- `start(response, email)`: after a full sign-in (a token was received).
  1. Save `lastEmail` and put the token in memory.
  2. If biometrics are usable:
     - write the token to SecureStore (Android prompts once here);
     - then write `sessionMarker`, with `expiresAt` from the response, or
       `null` if the backend did not send it.
  3. A failed or cancelled write leaves no marker. The app still works for
     this run.
  4. Hand `contacts_token` to contact sync if present, and nothing if absent.
- `unlock()`: read the token from SecureStore. The OS shows the biometric
  prompt.
  - **Success:** the token goes into memory.
  - **The read returns `null`, or fails with not-found or
    key-permanently-invalidated:** biometrics changed. Clear the stored
    session and report `changed`.
  - **User cancel:** report `cancelled`. Keep the session.
  - **Any other error** (lockout, a denied iOS Face ID permission, unknown):
    report `failed`. Keep the session.

  Only a definite invalidation clears the session, so a misread error costs at
  worst one tap on "Sign in with password".
- `lock()`: drop the in-memory token. The stored session stays.
- `end()`: delete the SecureStore item and `sessionMarker`, and drop the
  in-memory token. `lastEmail` stays.
- `status()`:
  - `unlocked` when a token is in memory;
  - `locked` when the marker exists, is unexpired and biometrics are usable;
  - `none` otherwise.
  - An expired marker is cleared on read, and status reports `expired` once so
    that the sign-in screen can say why.
- On `Platform.OS === 'web'`:
  - `start()` writes the token to AsyncStorage.
  - `status()` loads a stored token into memory and reports `unlocked`, or
    `none` when there isn't one. It never returns `locked`.
  - The lock timer is off.
- A marker with `expiresAt: null` counts as unexpired.

**Upgrade migration.** On first run, if AsyncStorage still holds the old
`authToken`:
1. delete it;
2. call `onSessionEnded({ explicit: false })`, which takes the old full token
   out of the contact worker's prefs;
3. set `sessionMigrated`.

Everyone signs in once.

### Routing

The root layout's `useProtectedRoute` asks `session.status()` instead of calling
`api.restore()`. The decision is a pure function,
`routeFor({ status, inAuthGroup })`:

- `unlocked`: stay where you are.
- `locked`: go to `/(auth)/unlock`.
- `none` or `expired` outside `(auth)`: go to `/(auth)/login`. For `expired`,
  pass `reason=expired`.

`app/index.js` uses the same function.

### Lock timer

An `AppState` listener lives in the root layout.

- **Going to `background`:** record the time. Only `background` counts, never
  `inactive`. On iOS the Face ID sheet and Control Centre make the app
  `inactive`, and counting that would lock the app during its own unlock.
- **Back to `active`:** if the session is unlocked and
  `shouldLock(backgroundedAt, now)` holds, meaning at least 5 minutes have
  passed, call `session.lock()` and route by `status()`.
  - A phone with a stored session goes to the unlock screen.
  - A phone without one (no biometrics) goes to sign-in.

A process killed in the background comes back through a cold start and locks
the same way.

### Screens

**Sign-in (`app/(auth)/login.js`)**
- The email is prefilled from `lastEmail`, and when it is present the password
  field takes focus. The email stays editable.
- A `reason` route param shows one line above the form:
  - `expired`: "Your session expired — sign in again."
  - `changed`: "Face ID changed on this phone — sign in with your password."
    The biometric name comes from the unlock label.
- On success it calls `session.start()` through `routePostAuth`.
- The screen still runs the VPN check before showing the form.

**Unlock (`app/(auth)/unlock.js`, new)**
- Same auth theme as sign-in: logo, "Accel Staff", and `lastEmail` underneath.
- One primary button, "Unlock with {label}". The screen calls it once by itself
  when it mounts.
- A secondary link, "Sign in with password", pushes `/(auth)/login`. The stored
  session is left alone until a password sign-in replaces it.
- What each `unlock()` result does:
  - `cancelled`: no message; the button stays.
  - `failed`: "Couldn't unlock. Try again, or sign in with your password."
  - `changed`: `router.replace('/(auth)/login?reason=changed')`.
  - success: `router.replace('/(main)')`.
- No VPN check runs first, because unlocking needs no network. If the first
  request after unlocking hits the IP block, the existing 403 handler routes to
  `/(auth)/vpn`.

**OTP (`app/(auth)/otp.js`)** looks the same. It passes the email it was given
by the sign-in screen and calls `session.start()`.

**VPN (`app/(auth)/vpn.js`)** routes to `/` once the network is allowed, not to
`/(auth)/login`. `/` then routes by `status()`, so an unlocked user who drops
off the VPN comes straight back to the app instead of being asked for the
password.

### API client (`app/services/api.js`)

- Every request sends `X-Accel-Client: staff-app`.
- A 401 on a request that carried the session token calls `session.end()` and
  `onSessionEnded({ explicit: false })`, then routes to
  `/(auth)/login?reason=expired`.
- The existing wrong-password handling stays: a 401 on `/login` itself is not
  a session end.
- `ALL_AUTH_KEYS` stops listing `authToken`. `lastEmail` is never in it.

### Sign out (`app/components/LogoutButton.js`)

Sign-out works as today: `api.logout()`, which now also kills the contacts
token server-side, then `onSessionEnded({ explicit: true })`, then clearing the
cached staff profile. Clearing the session goes through `session.end()`, and
`lastEmail` is kept.

### Contact sync

`onSessionStarted(contactsToken, API_BASE_URL)` receives the contacts token.

- The Kotlin module is unchanged: it stores whatever it is given.
- The worker keeps syncing while the app is locked.
- When its token dies, it keeps today's behaviour: `lastError=auth`, the
  "Sign in again to keep contacts up to date" row, and the contacts already on
  the phone are kept.
- Background sync now works for 30 days after a sign-in instead of about ten
  hours.

### Native config and build

- `npx expo install expo-secure-store expo-local-authentication`.
- In `app.json` plugins:
  - `["expo-secure-store", { "faceIDPermission": "Accel Staff uses Face ID to unlock your session.", "configureAndroidBackup": false }]`.
    Backup is already off, and the accel-contacts plugin owns
    `dataExtractionRules`.
  - `["expo-local-authentication", { "faceIDPermission": "Accel Staff uses Face ID to unlock your session." }]`.
- `runtimeVersion` goes from `1.0.0` to `1.1.0`, so an OTA update never reaches
  a binary without the new native modules. Then new EAS builds for iOS and
  Android.

### Docs

- `README.md`: replace "It makes no backend changes", the login paragraph and
  the "only persisted values" list with the new model. Name the backend change
  and link this spec.
- `docs/api-contract.md`: add the header, the `contacts_token` and
  `expires_at` response fields, the per-kind revocation, the new expiry and
  the `address-book` guard.
- `app/constants/storageKeys.js`: update the token comments. Drop the
  "daily re-login is expected" note.

## Rollout order

1. **Backend deploy.**
   - Old app builds send no header, so the backend treats them as web: the
     same behaviour and lifetime as today.
   - The migration backfills `expires_at` before the new listener matters.
2. **App builds (1.1.0).** The app tolerates a missing `expires_at` (the
   marker has no expiry, and a 401 handles the rest) and a missing
   `contacts_token` (the worker gets nothing). So a deploy that slips out of
   order degrades sync, not sign-in.

## Error handling summary

| Situation | Result |
|---|---|
| Biometric prompt cancelled | Stay on unlock screen, no message |
| Biometric lockout / other failure | Unlock screen message; password link available |
| Face or fingerprint added or removed | Session cleared; sign-in with `reason=changed` |
| iOS Face ID permission denied | Every unlock fails; user signs in with the password, like a phone with no biometrics |
| Android write prompt cancelled after sign-in | App works this run; no stored session, password next time |
| 30 days up (marker) | Sign-in with `reason=expired`, no biometric prompt first |
| 401 on any session request | Session cleared; sign-in with `reason=expired` |
| Off the VPN after unlock | Existing 403 handler → VPN screen → back to the app when allowed |
| Contacts token rejected | Worker records `auth`; contacts kept |

## Testing

**Backend (PHPUnit feature tests in `accelit/tests/Feature`)**
- A web login leaves the user's `staff_app` tokens valid.
- An app login leaves `auth_token` valid.
- A second web login revokes the first web token.
- A second app login revokes both earlier app tokens.
- An app login returns `token`, `contacts_token` and `expires_at`, with
  `staff_app` expiring 30 days out; a web token expires 600 minutes out.
- Both the `login()` no-MFA path and the `checkOTP()` path apply the header.
- The contacts token gets 200 on `/address-book` and 403 on `/me`.
- A full token still gets 200 on `/address-book`.
- An app logout deletes both app tokens; a web logout deletes only its own.
- The migration backfills `expires_at` on null rows only.

**App (Vitest, with the native modules mocked)**
- `session.js`:
  - start with and without biometrics;
  - a failed write;
  - `unlock()` mapping each outcome (success, null, invalidated, cancelled,
    other);
  - `status()` for every state, including the one-shot `expired`;
  - `end()` keeps `lastEmail`;
  - the upgrade migration;
  - web behaviour.
- `shouldLock` and `routeFor` as pure functions.
- The API client sends the header, and a session 401 calls `session.end()`.
- `routePostAuth` hands the contacts token, not the main one, to contact sync.
- `tests/rootLayout.test.js` updated for `session.status()` in place of
  `api.restore()`.

**Real devices** (`docs/biometric-unlock-verification.md`, new, in the style of
`contact-sync-verification.md`), because emulators do not enforce
biometric-bound keys:
- iPhone with Face ID: first sign-in, then cold start and unlock.
- Android with fingerprint, the same, including the one-time write prompt.
- Add a fingerprint or face, then open the app: password is required and the
  message is shown.
- A phone with no biometric enrolled: password on cold start and after 5+
  minutes away.
- Background for under 5 minutes: no prompt. Over 5 minutes: prompt.
- Signed in on web and app at once; sign in again on each; neither signs the
  other out.
- Set `staff_app.expires_at` in the past: next open goes to sign-in with the
  expired message.
- Sign out: next open goes to sign-in with the email prefilled.
- Contact sync runs while the app is locked.
- Off the VPN after unlocking: the VPN screen, then back into the app.

## Out of scope

- The phone's PIN or passcode as a fallback.
- A settings switch to turn biometric unlock off, or a list of signed-in
  devices.
- Sliding expiry or token refresh.
- Moving the MFA remembered-device token out of AsyncStorage.
- The client portal's login.
- Contact sync on iOS.
