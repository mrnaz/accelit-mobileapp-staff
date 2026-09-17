# Android contact sync — design

Date: 2026-09-17
Status: awaiting review

## Goal

Project the staff directory (`GET /api/address-book`) into Android's Contacts
Provider as raw contacts owned by an app-specific account, so directory people
show up in Contacts and caller ID, aggregate with the user's own contacts, never
reach Google Contacts, refresh hourly, and vanish when the account or the app is
removed. The server is authoritative; the device copy is a projection.

Android only. On iOS and web every entry point is a no-op and the toggle is not
rendered.

## Decisions taken

| Question | Decision |
|---|---|
| Backend changes | None. Full download each sync, local per-row hash diff. |
| Opt-in surface | A switch row on the Address Book screen. |
| Where sync runs | All-native Kotlin worker in a local Expo module. No headless JS. |
| Logout | Removes the account (and so the contacts) and cancels the worker. |
| Expired token in background (401) | Contacts kept, worker retries, no navigation, token untouched. |
| 403 (address-book permission revoked) | Treated like any HTTP failure: contacts kept. |
| Mass-deletion guard | Kept (see Sync algorithm, step 4). |
| Local mapping store | None. Mapping lives in our own raw-contact columns. |

## Constraints found in the repo

- Expo 54 managed app, no `android/` directory (continuous native generation).
  Native code therefore ships as a local Expo module under `modules/`, and
  manifest/backup changes come from a config plugin. The feature does not work
  in Expo Go; it needs a dev-client or EAS build.
- No Android SDK on the development machine. Kotlin cannot be compiled or unit
  tested locally; it is compiled by EAS builds. JUnit tests are written and run
  wherever an SDK exists (EAS/CI or after installing Android Studio).
- The bearer token lives in AsyncStorage and is owned by `app/services/api.js`.
  The worker runs without JS, so native needs its own copy.
- `GET /api/address-book` returns a bare array, no pagination, no revision or
  ETag. Rows are `client_contact` / `general_contact` (keyed by `contact_id`)
  and `client` (keyed by `client_id`). Only rows with an email or phone appear.

## Identifiers

- Android package: `com.accelit.staffapp`
- `ACCOUNT_TYPE = "com.accelit.staffapp"`
- `ACCOUNT_NAME = "Accel Staff"`
- Periodic work name: `accel-contact-sync`
- One-off work name: `accel-contact-sync-now`

## Structure

```
modules/accel-contacts/
  expo-module.config.json
  app.plugin.js                  config plugin
  index.js                       JS API, no-op off Android
  android/
    build.gradle                 work-runtime-ktx, security-crypto, okhttp, junit
    src/main/AndroidManifest.xml
    src/main/res/xml/authenticator.xml
    src/main/res/xml/syncadapter.xml
    src/main/res/xml/accel_data_extraction_rules.xml
    src/main/java/com/accelit/staffapp/contacts/
      AccelContactsModule.kt     Expo module: JS-facing functions
      StubAuthenticator.kt       AbstractAccountAuthenticator, every method inert
      AuthenticatorService.kt
      StubSyncService.kt         declared only; never syncs
      SessionStore.kt            EncryptedSharedPreferences
      DirectoryEntry.kt          data class + normalisation + hash
      DirectoryClient.kt         OkHttp fetch + validation → FetchResult
      DirectoryDiff.kt           pure diff
      DeletionGuard.kt           pure mass-deletion check
      ContactsStore.kt           the only class that touches ContactsContract
      ContactSyncWorker.kt       CoroutineWorker
      SyncScheduler.kt           WorkManager enqueue/cancel
    src/test/java/...            JUnit for DirectoryEntry, DirectoryClient
                                 parsing, DirectoryDiff, DeletionGuard
app/utils/contactSync.js         wrapper used by screens and api.js
tests/contactSync.test.js
docs/contact-sync-verification.md
```

Each unit has one job. `DirectoryDiff`, `DeletionGuard` and the parsing half of
`DirectoryClient` are pure and carry the logic worth testing; `ContactsStore`
and the worker are thin.

## Account and manifest

- `AuthenticatorService` exposes `StubAuthenticator` with the
  `android.accounts.AccountAuthenticator` intent filter and
  `authenticator.xml` (`accountType`, app icon, label "Accel Staff").
  `addAccount` from system Settings returns an error bundle: the account is
  only ever created by the app via `AccountManager.addAccountExplicitly`.
- `StubSyncService` + `syncadapter.xml` declare a contacts sync adapter for
  authority `com.android.contacts` with `supportsUploading="false"`,
  `userVisible="false"`. After creating the account the module calls
  `ContentResolver.setIsSyncable(account, "com.android.contacts", 0)`. The
  adapter therefore never runs; it exists so Contacts apps classify the
  account's raw contacts as read-only (user edits go to the user's own account,
  not ours). **To verify on device**; if the declaration proves unnecessary or
  harmful on tested versions it is removed. It uploads nothing under any
  circumstances.
- Permissions added by the plugin: `READ_CONTACTS`, `WRITE_CONTACTS`.
  `GET_ACCOUNTS`/`AUTHENTICATE_ACCOUNTS`/`MANAGE_ACCOUNTS` are not needed for an
  app's own account type on the supported SDK range (minSdk 24).
- Backup: `app.json` sets `android.allowBackup: false`. The plugin also sets
  `android:dataExtractionRules` to a rules file that excludes every domain from
  both `<cloud-backup>` and `<device-transfer>`, and `android:fullBackupContent`
  is left unset because backup is disabled outright.

## Identity and mapping

No separate mapping database. The mapping is stored on our own raw contacts:

| Spec field | Storage |
|---|---|
| `server_contact_id` | `RawContacts.SOURCE_ID` = `contact:<contact_id>` or `client:<client_id>` |
| `android_raw_contact_id` | `RawContacts._ID` |
| `server_revision` | `RawContacts.SYNC1` = SHA-256 hex of the normalised entry |

This cannot drift from the provider, is removed with the account, and leaves no
directory data in app-private storage. `Contacts._ID` / `CONTACT_ID` is never
read or stored.

### Entry normalisation

A `DirectoryEntry` is built per key:

- `key`: `contact:<id>` for `client_contact` and `general_contact`,
  `client:<id>` for `client`.
- `given`, `family`: `fname`, `sname` (contacts). `displayName`: `displayname`.
  Clients have only `displayName`.
- `organization`: `client_name` for `client_contact`; null for the other two
  (a client's own name is already its display name).
- `phones`, `emails`: trimmed, empty dropped, de-duplicated, sorted.
- Rows sharing a key merge: phones and emails union; name fields from the first
  row.
- Hash input: a canonical string of the fields above in fixed order. A schema
  version constant is prefixed so a future mapping change forces a rewrite.

### Raw contact shape

`RawContacts`: `ACCOUNT_TYPE`, `ACCOUNT_NAME`, `SOURCE_ID`, `SYNC1`.
`Data` rows: one `StructuredName`; one `Phone` (`TYPE_WORK`) per phone; one
`Email` (`TYPE_WORK`) per email; one `Organization` (`COMPANY`) when present.

On account creation one `ContactsContract.Settings` row is inserted for the
account with `UNGROUPED_VISIBLE = 1`, so contacts without a group are shown.

Aggregation is left entirely to the provider. No `AggregationExceptions` are
written.

## ContactsStore contract

- `listOwned(): List<LocalRow(rawContactId, sourceId, hash)>` — query
  `RawContacts` with `ACCOUNT_TYPE=? AND ACCOUNT_NAME=? AND DELETED=0`.
- `apply(creates, updates, deletes)` — builds `ContentProviderOperation`s,
  `applyBatch` in chunks of ≤ 400 ops, yield point at each raw-contact boundary.
  - Create: insert raw contact + data with back-references.
  - Update: delete `Data` where `RAW_CONTACT_ID=?`, insert fresh data, update
    `SYNC1`. The raw-contact update selection includes account type and name as
    well as `_ID`.
  - Delete: delete raw contact by `_ID` **and** account type and name.
- Every URI carries `CALLER_IS_SYNCADAPTER=true` plus the account query
  parameters, so deletes are real deletes rather than tombstones, and the
  provider itself rejects cross-account writes.
- There is no method that accepts an arbitrary selection, URI or contact id.
  Touching another account's rows is not expressible through this class.

## Sync algorithm (`ContactSyncWorker.doWork`)

Guarded by a process-wide `Mutex` so periodic and one-off runs never overlap.

1. **Preconditions**
   - feature not enabled → `success`, nothing done.
   - contacts permission missing → record `lastError=permission`, `success`
     (retrying cannot fix it; the toggle reflects it next time the screen opens).
   - account missing (user removed it in system Settings) → cancel both works,
     `enabled=false`, `success`.
   - no token or base URL → record `lastError=auth`, `retry`.
2. **Fetch** `GET {baseUrl}/api/address-book` with `Authorization: Bearer` and
   `Accept: application/json`, 30 s timeouts. `FetchResult` is one of:
   - `Ok(entries)` — status 200, body parses as a JSON array, every row has a
     known `type` and the id its type requires.
   - `Failure(kind)` — `auth` (401), `http` (any other non-200, including 403),
     `network` (IOException/timeout), `malformed` (anything else, including one
     bad row: a partial directory is not trusted).
   On `Failure`: write nothing to the provider, record `lastError`, return
   `retry`. The worker never clears the token, never logs the user out.
3. **Diff** server entries against `listOwned()` by `SOURCE_ID`:
   absent locally → create; hash differs → update; absent on server → delete;
   equal → nothing. Duplicate local `SOURCE_ID`s (should never happen) keep the
   lowest `_ID` and delete the rest.
4. **Deletion guard** — if the diff would delete every local contact, or more
   than 50 % of a local set of ≥ 20, the run is *suspect*: creates and updates
   are applied, deletes are withheld, and a fingerprint of the delete set is
   stored. If the next successful fetch produces the same delete set, deletes
   are applied. Any different result resets the fingerprint.
5. **Apply** — if all three sets are empty, make no provider call at all.
6. **Record** `lastSuccessAt = now`, `lastError = null`. Return `success`.

An exception from `applyBatch` is a failure: `lastError=provider`, `retry`.
Because each chunk is atomic and identity is `SOURCE_ID`, a half-applied run is
repaired by the next one without duplicates.

## Scheduling

- `enable` → `enqueueUniquePeriodicWork("accel-contact-sync", KEEP,
  PeriodicWorkRequest(1 hour), constraints: NetworkType.CONNECTED)` and a
  one-off sync.
- `syncNow` → `enqueueUniqueWork("accel-contact-sync-now", KEEP,
  OneTimeWorkRequest, NetworkType.CONNECTED)`.
- `disable` → cancel both unique works.
- No exact alarms, no foreground service, no expedited work. Deferred or
  skipped runs are harmless: each run is a full reconcile.
- Uninstall removes WorkManager's database with the app, the system removes the
  account because its authenticator is gone, and the Contacts Provider purges
  raw contacts of accounts that no longer exist.

## Native session store

`SessionStore` (EncryptedSharedPreferences, excluded from backup by the rules
above) holds: `token`, `baseUrl`, `enabled`, `lastSuccessAt`, `lastError`,
`pendingDeleteFingerprint`. No contact data.

## JS API (`modules/accel-contacts/index.js`)

All functions resolve to a harmless default when `Platform.OS !== 'android'` or
the native module is absent (Expo Go, web).

- `isSupported(): boolean`
- `setSession(token, baseUrl): Promise<void>`
- `clearSession(): Promise<void>`
- `enable(): Promise<void>` — requires permissions already granted; creates the
  account if missing, writes the Settings row, sets `enabled`, schedules.
- `disable(): Promise<void>` — cancels work, `enabled=false`,
  `AccountManager.removeAccountExplicitly`.
- `syncNow(): Promise<void>`
- `getStatus(): Promise<{ enabled, hasPermission, accountExists, lastSuccessAt, lastError }>`

## App integration

`app/utils/contactSync.js`:

- `turnOn()` — request `READ_CONTACTS` + `WRITE_CONTACTS` via
  `PermissionsAndroid.requestMultiple`; if both granted → `enable()` and return
  `{ ok: true }`; otherwise `{ ok: false, reason: 'denied' | 'blocked' }`.
- `turnOff()` — `disable()`.
- `refreshIfStale(now)` — if enabled and (`lastSuccessAt` null or older than one
  hour) → `syncNow()`.
- `onSessionStarted(token)`, `onSessionEnded({ explicit })` — see below.

Wiring:

- `app/services/api.js`: where the token is persisted after OTP and where
  `restore()` finds one → `setSession(token, API_BASE_URL)`. Logout →
  `disable()` then `clearSession()`. 401 handler → `clearSession()` only;
  contacts stay until the user signs in again or logs out.
- `app/(main)/address-book.js`: Android-only switch row "Show in phone
  contacts" above the list, caption "Last synced …" / a one-line error from
  `lastError`. Denied permission leaves the switch off with "Contacts permission
  is needed to show the directory in your phone." Pull-to-refresh also calls
  `syncNow()` when enabled. Layout follows the qobox staff app conventions
  already used on this screen.
- `app/_layout.js`: on `AppState` → `active`, and once after the authenticated
  layout mounts, call `refreshIfStale(Date.now())`.

## Error handling summary

| Situation | Provider writes | Worker result |
|---|---|---|
| 401 | none | retry |
| 403 / 5xx / other non-200 | none | retry |
| Timeout / no network | none | retry |
| Body not a JSON array, or any invalid row | none | retry |
| 200 `[]` or mass deletion, first time | creates/updates only | success |
| Same mass deletion twice running | full | success |
| Permission revoked | none | success (idle) |
| Account removed by user | none; feature switched off | success |

## Testing

- **Vitest** (`tests/contactSync.test.js`, native module mocked): permission
  granted / denied / blocked paths, `refreshIfStale` thresholds, session
  start/end wiring (explicit logout disables; 401 does not), off-Android no-ops.
- **JUnit** (module `src/test`): normalisation and hashing (merge of duplicate
  keys, stable ordering, schema version), response validation (non-array, bad
  row, unknown type), diff (create/update/delete/unchanged, idempotence — diff
  of applied result is empty, duplicate local source ids), deletion guard.
  Not runnable on the current dev machine; run in EAS/CI or after installing an
  SDK.
- **Device checklist** (`docs/contact-sync-verification.md`): one entry per
  acceptance criterion with the manual or `adb` step that proves it —
  `adb shell content query --uri content://com.android.contacts/raw_contacts
  --projection account_type:sourceid:sync1`, caller-ID lookup, aggregation with
  a Google contact of the same number, airplane-mode and expired-token runs,
  unchanged-directory run showing no `version` bumps, account removal,
  uninstall/reinstall, contacts.google.com check after forcing a Google sync,
  proxy capture for third-party uploads, `adb shell bmgr` backup check.

## Out of scope

- iOS contact integration.
- Contact photos.
- Backend change detection (ETag/revision); the hash diff makes it a later,
  app-transparent optimisation.
- Writing user edits back to the server.
