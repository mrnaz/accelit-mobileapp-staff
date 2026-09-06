# Accel IT Admin API — Contract for the React Native Staff App

Derived by reading the actual controller/transformer/repository code on `dev`
(no docs, no guessing). File paths are given so anything here can be re-verified
against source. Every JSON example uses real field names; values are
representative, not literal captures.

## Conventions that apply to every endpoint below

- **Host**: all routes in this contract live inside
  `Route::domain($adminDomain)->...` where `$adminDomain` is parsed from
  `env('APP_ADMIN_URL')`. The app must hit the **admin** host, not the client
  portal host — they are different domains/subdomains in this app.
  (`routes/app/api.php:108-122`)
- **Auth header**: `Authorization: Bearer {token}`. Tokens are Sanctum
  personal-access tokens (`$user->createToken(...)->plainTextToken`), not
  SPA cookie sessions, so a bearer header is all that's needed — no CSRF
  cookie dance.
- **Token abilities**: every fully-authenticated token is minted with
  abilities `['*']` (`AuthController::login`/`checkOTP`, via
  `createToken('auth_token')` with no explicit ability list, which defaults to
  `['*']`). The one exception is the short-lived OTP-stage token
  (`createToken('token', ['otp'])`), which only satisfies routes gated
  `token.can:otp` (i.e. `POST /api/check-otp` and `POST /api/switch-mfa-method`)
  and will be rejected by every other endpoint in this document.
- **Token TTL**: `config('sanctum.expiration') = 600` minutes (`config/sanctum.php:49`).
  After that the token simply stops authenticating — same 401 as an invalid token.
- **Unauthenticated request** (missing/invalid/expired token) on any
  `auth:sanctum` route → **401**, body:
  ```json
  { "message": "Unauthenticated." }
  ```
  This is a custom override in `app/Exceptions/Handler.php:35-40` (done specifically
  so the API never tries to redirect to a login *page*).
- **Wrong token ability** (e.g. an OTP-stage token hitting a normal endpoint) → **403**:
  ```json
  { "message": "Invalid ability provided." }
  ```
  (`Laravel\Sanctum\Exceptions\MissingAbilityException`, default message, thrown by
  `CheckAbilities` middleware — this is distinct from every hand-written
  `Gate::allows(...)` 403 below, which use their own message text.)
- **Validation failure** (`FormRequest::rules()` fails) → Laravel's stock **422**:
  ```json
  { "message": "The given data was invalid.", "errors": { "field": ["message"] } }
  ```
  No controller in this set overrides this shape.
- **Model not found** (`findOrFail`/route-model-binding miss) → stock **404**:
  ```json
  { "message": "No query results for model [App\\Models\\Ticket] 123" }
  ```
  Note the fully-qualified PHP class name leaks into the message — cosmetic, but
  don't pattern-match on it beyond "contains 'No query results'".
- **Boolean query-param gotcha (recurs across several endpoints)**: controllers read
  boolean-ish query flags with plain PHP truthiness (`if ($request->query('all', false))`,
  `if ($params['all'])`), not `filter_var(..., FILTER_VALIDATE_BOOLEAN)`. In PHP,
  the **string** `"false"` is truthy. So `?all=false` or `?show_deleted=false`
  turns the flag **on**, not off. To get the "off" behavior, omit the parameter
  entirely (or send `0`). This affects `ClientContactController::index`
  (`all`, `show_deleted`) and `ClientAssetController::index` (`all`,
  `show_deleted`). A couple of endpoints (`TicketController::index`) instead do
  an explicit `== "true"` string compare, which is safe — those are called out
  per-endpoint below.

---

## Auth

### `GET /api/login-ip-check`
No auth middleware (deliberately public — a client can't know if it's logged in yet).
`app/Http/Controllers/AuthController.php:30-44`

- **Auth**: none.
- **Query params**: none read.
- **Response** `200`:
  ```json
  { "allowed": true }
  ```
  `allowed` is `true` unconditionally if `config('ip-whitelist.login_whitelist')` is
  empty; otherwise it's the result of checking the caller's IP against that whitelist.
- **App notes**: bare object, single boolean field, no envelope quirks. Used by the
  SPA to decide whether to even show a login form before the user types anything.

### `POST /api/login`
`app/Http/Controllers/AuthController.php:46-143`. Behind `ip.whitelist` middleware
group (same server-side IP whitelist check is also re-run inside the method).

- **Auth**: none (this *creates* the auth).
- **Body**: `email` (required, email), `password` (required, min 6) — validated by
  `LoginAuthRequest`.
- **Authorization / IP gate**: if `config('ip-whitelist.login_whitelist')` is set and
  the caller's IP isn't in it → **403**:
  ```json
  { "errors": { "ip": ["Access from your IP address is not permitted."] } }
  ```
  (Note: this is the in-controller check. The confirmed/known shape
  `{"message":"Access denied. Your IP address is not authorized..."}` comes from
  the `ip.whitelist` middleware itself rejecting the request *before* it reaches the
  controller — so a 403 on this endpoint can carry **either** shape depending on
  which layer rejected it. The app must not assume one specific 403 body here.)
- **Bad credentials** → **401**:
  ```json
  { "errors": { "credentials": ["Invalid Username or Password."] } }
  ```
- **Success paths** (branches on `$user->mfa_default` and trusted-device cookie):
  1. Trusted device (device-token cookie recognised) or no MFA configured → **200**:
     ```json
     {
       "token": "1|abcdef...",
       "user": { "id": 5, "fname": "Jo", "sname": "Doe", "email": "jo@accelit.com.au", "abilities": ["see-dashboard", "..."] }
     }
     ```
     (`user` shape = `BasicUserTransformer` — see below.)
  2. MFA required → **200**, no token yet:
     ```json
     {
       "otpToken": "2|partial-token-with-otp-ability",
       "maskedMFA": "j***@accelit.com.au",
       "mfaType": "email",
       "availableMethods": ["email", "sms"],
       "hasMultipleMethods": true
     }
     ```
     `otpToken` is scoped to ability `otp` only — use it as the bearer token for
     `POST /api/check-otp` and `POST /api/switch-mfa-method`, nothing else.
- **App notes**: two structurally different 200 shapes on the same endpoint —
  branch on presence of `token` vs `otpToken`. `BasicUserTransformer` does **not**
  include MFA fields, teams, or client-access settings — that's `/api/me`'s job,
  call it right after storing the token.

### `POST /api/check-otp`
`app/Http/Controllers/AuthController.php:227-276`. Requires
`auth:sanctum` + `token.can:otp` (i.e. must send the `otpToken` from login as the bearer token).

- **Body**: `otp` (required, string, exactly 6 chars), `remember_device` (optional bool)
  — `CheckOTPRequest`.
- **Wrong code** → **200** (not 401/422):
  ```json
  { "verified": false }
  ```
- **Correct code** → **200**:
  ```json
  {
    "verified": true,
    "token": "3|full-access-token",
    "user": { "id": 5, "fname": "Jo", "sname": "Doe", "email": "jo@accelit.com.au", "abilities": ["..."] },
    "device_token": "base64-cookie-value"
  }
  ```
  `device_token` is present **only** if `remember_device: true` was sent.
- **App notes**: `verified:false` is a normal 200, not an error — the app must check
  the boolean, not the HTTP status. This is the one place a wrong-password-style
  failure does *not* get a 4xx.

### `POST /api/switch-mfa-method`
`app/Http/Controllers/AuthController.php:306-365`. Same auth as check-otp
(`auth:sanctum` + `token.can:otp`).

- **Body**: `method` (required, one of `totp|sms|email`) — validated inline via
  `$request->validate(...)`, not a FormRequest, but same 422 shape.
- **Method not available for this user** → **400**:
  ```json
  { "error": "The selected MFA method is not available for your account." }
  ```
  Note the key is `error`, singular — every other error response in this API uses
  `message` or `errors`. This is the one outlier.
- **Success** → **200**:
  ```json
  { "success": true, "maskedMFA": "+61******123", "mfaType": "sms" }
  ```
- **App notes**: does not return a new `otpToken` — keep using the one from
  `/api/login`. Only re-sends the OTP via the newly selected channel.

### `POST /api/logout`
`app/Http/Controllers/AuthController.php:145-152`. `auth:sanctum` + `token.can:*`.

- **Response** `200`: `{ "message": "Successfully logged out" }`
- Deletes only `auth()->user()->currentAccessToken()` — i.e. the token used on
  *this* request, not all of the user's tokens/devices.

### `GET /api/me`
`app/Http/Controllers/MeController.php:17-22`, transformer
`app/Transformers/MeTransformer.php`. `auth:sanctum` + `token.can:*`.

- **Auth**: no additional gate beyond being authenticated with a full-ability token.
- **Response** `200` — bare object (not `{data: ...}` — the controller unwraps
  `->toArray()['data']` itself), full shape:
  ```json
  {
    "id": 5,
    "fname": "Jo",
    "sname": "Doe",
    "email": "jo@accelit.com.au",
    "photo": "https://.../staff-photo/.../file.jpg",
    "active_work_session": {},
    "tickets_assigned_count": 3,
    "dob": null,
    "address_id": null,
    "address": null,
    "timezone": "Australia/Melbourne",
    "phone": "+61...",
    "mfa_totp_secret": "JBSWY3DPEHPK3PXP",
    "mfa_email": "jo@accelit.com.au",
    "mfa_sms_phone": "+61...",
    "mfa_default": "email",
    "teams": [ { "id": 1, "name": "Field", "team_leader": 5, "staff": [ { "id": 5, "fname": "Jo", "sname": "Doe", "full_name": "Jo Doe" } ] } ],
    "abilities": ["see-dashboard", "access-addressbook", "..."],
    "sysadmin": false,
    "permission_addressbook": false,
    "permission_assetlist": true,
    "client_access_assigned": "full",
    "client_access_ticketed": "none",
    "client_access_all": "none",
    "ticket_access": "assigned",
    "permission_project_access": "full",
    "permission_project_assigned_only": false,
    "can_access_project_pricing": false,
    "can_access_project_workspace": true
  }
  ```
- **Important shape gotcha**: `active_work_session` is `{}` (empty object), **not**
  `null`, when the staff member has no active ticket work session. This is because
  Fractal's `DataArraySerializer::null()` returns `{"data": []}` and the controller
  unwraps `['data']`, giving `[]` — which PHP's `json_encode` renders as `[]` (an
  empty array) unless the surrounding structure forces object-cast; verify at
  runtime, but treat both `[]` and `{}` as "no active session," don't assume a
  populated work-session object always has fields.
- **Security note**: this endpoint returns the user's own `mfa_totp_secret` in
  plaintext. It's the user's own account, so not a bug, but the app must not log
  or cache this response carelessly.
- **`abilities`** is a filtered subset of a fixed list of Gate names the user
  passes (`manage-client-account`, `see-dashboard`, `manage-contracts`,
  `manage-projects`, `see-projects`, `manage-assets`, `manage-assets-onboarding`,
  `manage-slas`, `manage-msis`, `manage-msi-categories`,
  `manage-msi-billing-categories`, `manage-staff-members`, `see-staff-members`,
  `manage-teams`, `see-teams`, `manage-checklists`, `see-action-log`,
  `access-addressbook`, `access-assetlist`, `access-project`,
  `access-project-pricing`, `access-project-workspace`). Almost all of these
  gates are simply `return $user->sysadmin;` (`app/Providers/AuthServiceProvider.php:28-169`)
  — so for a non-sysadmin field engineer, `abilities` will be a very short list:
  typically just whatever `access-addressbook`/`access-assetlist`/`see-staff-members`/
  `see-teams` resolve to, based on their `permission_addressbook`/`permission_assetlist`
  flags (those two gates are the only ones that check anything other than `sysadmin`).
- **App notes**: this is the source of truth for what the current staff member can
  see — the app should gate its own UI off `sysadmin`, `client_access_*`,
  `ticket_access`, `permission_addressbook`, `permission_assetlist`, not off
  `abilities` alone, since most of the ability list is sysadmin-only regardless.

---

## Clients

### `GET /api/clients`
`app/Http/Controllers/ClientController.php:33-38` →
`app/Repositories/App/ClientRepository.php:18-147` (`getAll`), transformer
`app/Transformers/App/Client/ClientListPageTransformer.php`.

- **Auth**: no `Gate::allows` call in the controller — **but** the repository
  itself does access-scoping (see below). So there's no hard 403 here; a
  non-sysadmin simply gets a smaller (possibly empty) list.
- **Query params actually read**: `filter` (`leads` | `active` | `inactive` |
  anything else/absent → default), `tag_id` (int, inner-joins a
  `client_tag_links` filter). **`search` is not read at all** — confirmed, the
  repository never touches `$request->search`; if the SPA sends it, it's silently
  ignored server-side.
- **Access scoping** (confirmed and more specific than "known facts" state): for a
  non-sysadmin user, the repository calls `$user->getAccessibleClientIds()` and adds
  `AND clients.id IN (...)` to the `WHERE` clause. If that list is empty, the method
  returns PHP `[]` immediately (before even building the SQL) — so a field engineer
  with no client access at all gets an empty array, not a 403.
- **`filter` default behavior**: with no `filter` (or an unrecognized value), the
  query adds `AND clients.status <> 'lead'` — leads are excluded by default and
  only returned when `filter=leads` is explicitly passed.
- **Response**: **bare JSON array** (not `{data: [...]}`) — confirmed. Each row,
  from `ClientListPageTransformer`:
  ```json
  [
    {
      "id": 12,
      "name": "Accolade Screens",
      "open_tickets": 3,
      "timezone": "Australia/Melbourne",
      "endpoint_count": 14,
      "server_count": 2,
      "active_payment_methods": 1,
      "primary_site": { "...": "ClientListPagePrimarySiteTransformer shape" },
      "non_primary_sites": [ "...same shape..." ],
      "logo": "https://.../client-logo/.../file.png",
      "active": true,
      "tags": [ { "id": 3, "label": "VIP", "color": "#ff0000" } ],
      "status": "active",
      "happiness_rating": 4,
      "heat": "warm",
      "crm_stage": null
    }
  ]
  ```
  **Sysadmin-only extra fields** (only present in the payload if
  `auth()->user()->sysadmin` — a non-sysadmin's rows simply omit these keys
  entirely, they are not `null`):
  ```json
  { "msp_recurring": 1250.00, "arrears_invoices": 2, "arrears_amount": 480.50 }
  ```
- **Pagination**: none. Every accessible client comes back in one response,
  ordered by `clients.name`.
- **App notes**: bare array (client code must not do `response.data`), no
  search/pagination on the server — if the app wants search/filter-as-you-type
  it must filter client-side over the full (access-scoped) list. Sysadmin vs
  non-sysadmin responses have **different keys present**, not just different
  values — don't assume `msp_recurring` exists.

### `GET /api/clients/{id}`
`app/Http/Controllers/ClientController.php:40-50`, transformer
`app/Transformers/ClientTransformer.php`.

- **Auth**: `Gate::allows('access-client', $id)` → `$user->canAccessClient($id)`.
  Fails → **403**: `{ "message": "You do not have access to this client." }`.
  `canAccessClient` (`app/Models/Staff.php:112-130`): sysadmin always passes;
  for an `access_controlled` client, only sysadmin or a staff member explicitly
  assigned to that client (`assignedClients` pivot) passes — **not** governed by
  `client_access_*`; for a non-access-controlled client, falls through to
  `getClientAccessLevel($id) !== 'none'`.
- **Query params**: none.
- **Response** `200` — bare object, full shape:
  ```json
  {
    "id": 12,
    "name": "Accolade Screens",
    "email": "info@accolade.com.au",
    "phone": "+61...",
    "website": "https://...",
    "asset_prefix": "ACC",
    "projects": null,
    "contracts": null,
    "billing_contact": { "...": "ClientContactTransformer shape or {}" },
    "timezone": "Australia/Melbourne",
    "syncro_id": null,
    "xero_reference": "XR-1",
    "notes": "<p>signed media-url HTML</p>",
    "settings_autoapprove_tickets": false,
    "logo": "https://.../client-logo/.../file.png",
    "document_logo": null,
    "icon": null,
    "rmm_installer": true,
    "active": true,
    "address_books": [ "...ClientAddressbookTransformer shape..." ],
    "primary_site": { "...": "..." },
    "non_primary_sites": [],
    "tags": [],
    "status": "active",
    "happiness_rating": 4,
    "heat": "warm",
    "crm_stage": null,
    "access_controlled": false,
    "settings_tickets_comanaged": false
  }
  ```
  `projects` and `contracts` are `null` unless the caller passes
  `Gate::allows('manage-projects')` / `Gate::allows('manage-contracts')`
  respectively — **both of those gates are sysadmin-only** (`app/Providers/AuthServiceProvider.php:36-42`),
  so for a field engineer these two keys will **always be `null`**, never populated,
  regardless of the client.
- **Pagination**: n/a (single resource).
- **App notes**: for a non-sysadmin the `projects`/`contracts` keys exist but are
  always `null` — don't treat `null` here as "loading" or "no data," it's a
  permanent state for that user.

### `GET /api/clients/{id}/access-level`
`app/Http/Controllers/ClientController.php:55-66`.

- **Auth**: no `Gate::allows` — the method computes access itself and returns it
  (it can't 403 because the whole point is to report the access level, including
  "none").
- **Response** `200` — confirmed:
  ```json
  { "client_id": 12, "access_level": "full", "can_access": true }
  ```
  `access_level` is one of `"full" | "limited" | "none"` (confirmed against the
  admin SPA's own option list — `resources/js/_admin/views/pages/staff/members/dialogs/StoreUpdateStaffMemberPermissionsDialog.vue:245-247`).
  When `can_access` is `false`, `access_level` is forced to `"none"` regardless of
  what `getClientAccessLevel()` would otherwise compute.
- **App notes**: cheap pre-flight check the app can call before rendering a
  client detail screen, to decide whether to even attempt `GET /api/clients/{id}`.

### `GET /api/clients/{client}/contacts`
`app/Http/Controllers/ClientContactController.php:23-50`, transformers
`ClientContactTransformer` / `ClientContactBasicTransformer`.

- **Auth**: `Gate::allows('access-client', $client)` → same as above. Fails → **403**
  `{ "message": "Unauthorized." }` (different message text than the client-show 403,
  same gate).
- **Query params**:
  - `show_deleted` (boolean-ish, see gotcha above) → includes soft-deleted contacts.
  - `all` (boolean-ish, same gotcha) → if truthy, **ignores `{client}` entirely**
    and returns contacts for **every** client (no access-scoping applied to this
    branch — it's a straight `ClientContact::with(...)->get()` with no `client_id`
    filter and no accessible-clients check). Treat `all=1` as "all clients in the
    system," not "all contacts for this client."
  - `basic` (any truthy value) → switches the transformer to
    `ClientContactBasicTransformer` (id/fname/sname/photo only) instead of the
    full shape.
- **Response** `200` — bare array. Full shape (`ClientContactTransformer`):
  ```json
  [
    {
      "id": 44,
      "client_id": 12,
      "fname": "Pat",
      "sname": "Smith",
      "position": "Office Manager",
      "email": "pat@accolade.com.au",
      "phone": "+61...",
      "gender": null,
      "dob": null,
      "notes": null,
      "religion": null,
      "remote_access": false,
      "manage_tickets": true,
      "escalate_tickets": false,
      "photo": "https://.../client-contact-photo/.../file.jpg",
      "asset_count": 2,
      "default_contact": true,
      "billing_contact": false,
      "setting_recv_all_tickets": true,
      "view_passwords": false,
      "view_tickets": true,
      "view_contacts": true,
      "view_accounts": false,
      "view_assets": true,
      "view_projects": false,
      "client_emergency_contact": false,
      "site_id": 3,
      "site": { "id": 3, "sitename": "HQ" },
      "open_ticket_count": 1,
      "name": "Pat Smith",
      "deleted_at": null
    }
  ]
  ```
  `basic=1` shape:
  ```json
  [ { "id": 44, "fname": "Pat", "sname": "Smith", "photo": "https://..." } ]
  ```
- **Pagination**: none — always the full result set for the query as built.
- **App notes**: bare array either way. `basic` and `all`/`show_deleted` are
  independent flags and can combine (e.g. `?basic=1&all=1` returns every contact
  in the system, minimal fields).

### `GET /api/clients/{client}/sites`
`app/Http/Controllers/ClientSiteController.php:14-19`, transformer
`ClientSiteTransformer`.

- **Auth**: **none** — no `Gate::allows`, no `canAccessClient` check, nothing. Any
  authenticated staff token can list any client's sites by ID, regardless of that
  staff member's client access settings.
- **Query params**: none read (the `{client}` path segment is the only input).
- **Response** `200` — bare array, ordered `isprimary DESC`:
  ```json
  [
    {
      "id": 3,
      "client_id": 12,
      "sitename": "HQ",
      "phone": "+61...",
      "email": "hq@accolade.com.au",
      "address_id": 7,
      "address": { "...": "raw Address model attributes" },
      "client": { "...": "raw Client model attributes" },
      "siteContact": { "...": "raw ClientContact model or null" },
      "isprimary": true,
      "timezone": "Australia/Melbourne"
    }
  ]
  ```
  `address`, `client`, and `siteContact` are **raw Eloquent relations dumped
  as-is** (not run through their own transformers) — whatever columns those
  tables have and aren't `$hidden` will appear.
- **Pagination**: none.
- **App notes**: no authorization at all — see Gaps section. Also the least
  "shaped" response in this document: three nested objects are raw model dumps,
  not curated transformer output, so their field sets can shift if those tables
  gain/lose columns without anyone touching this transformer.

---

## Tickets

### `GET /api/tickets`
`app/Http/Controllers/TicketController.php:41-478`.

- **Auth**: no `Gate::allows` — access is baked into the SQL's `WHERE` clause for
  non-sysadmins (see below). Can't 403; a locked-out user just sees an empty list.
- **Query params actually read**: `limit` (default 100), `page` (default 1, used to
  compute `OFFSET`), `search` (free text — see below), `completed` (exact string
  `"true"` → completed tickets; anything else → open, i.e. `completed_at IS NULL`),
  `global_list` (exact string `"true"` → excludes `handling = 'comanaged'` tickets),
  `cold_storage` (exact string `"true"` → **includes** cold-storage tickets that are
  otherwise hidden by default). All four boolean-ish params use a safe `== "true"`
  compare, not PHP truthiness — unlike the contacts/assets endpoints above.
- **Server-side search**: honoured, and broad — matches (case-insensitively) ticket
  title, client name, creating client contact's name, creating staff's name, exact
  ticket ref (with and without a trailing check-digit stripped), affected users'
  names, assigned staff names, and tag labels (all via `LIKE`/`EXISTS` subqueries).
- **Access scoping** (non-sysadmin only): `tickets.client_id IN (accessible ids)`
  always applied, **plus**, depending on `$user->ticket_access`:
  - `all` (default): no further restriction beyond client access.
  - `assigned`: additionally requires the ticket have a `ticket_assignees` row for
    this staff member or one of their teams.
  - `none`: forced `1=0` — empty result.
- **Response** `200` — **not** an envelope-per-item; it's:
  ```json
  { "tickets": [ /* array of raw stdClass rows, see column list below */ ], "total": 137 }
  ```
  `tickets` rows are **not** run through `TicketsTransformer`/Fractal — they are
  the literal SQL result (with a few PHP-side JSON-decodes and media-URL
  lookups applied after the query). Every column present, in order of appearance
  in the `SELECT`:

  | column | notes |
  |---|---|
  | `id` | ticket PK |
  | `ticket_ref` | plain numeric ref |
  | `priority` | `CHAR(1)`: `L` (Low), `N` (Normal), `H` (High), `C` (Critical) — confirmed against `resources/js/utils/priority.js` |
  | `ticket_level` | small int, default `1`, "Level N" chip in the UI |
  | `title` | |
  | `handling` | `standard` \| `internal` \| `comanaged` |
  | `ticket_link` | opaque token used to build client-portal ticket URLs |
  | `client_id`, `client_name` | joined from `clients` |
  | `created_by_client`, `created_by_staff`, `created_by_other` | at most one is non-null |
  | `creator_details` | computed display name from whichever of the above is set, or `'Unknown'` |
  | `assigned_staff` | computed display string, e.g. `"Jo Doe"` or `"Jo Doe +2 more"`; prioritizes showing the *current user* first if they're one of the assignees |
  | `assigned_staff_id` | current-user-aware: if the current user is assigned, this is always their own id even with multiple assignees |
  | `assigned_cc_id`, `assigned_cc` | client-contact assignee equivalent of the above two, only populated when there's no staff assignee |
  | `assignee_count` | total active assignee rows |
  | `assigned_team` | first team name if any assignee is a team |
  | `created_at`, `assigned_at` | |
  | `note_created_at` | timestamp of latest non-system note |
  | `note_type` | `private` \| `client` \| `staff` (derived from the latest non-system note) — **there is no `status` column anywhere on this row; "open" is `completed_at IS NULL`** |
  | `work_session_completed_at`, `override_time`, `calculated_time`, `session_count` | aggregated from `ticket_work_sessions` |
  | `completed_at`, `deleted_at` | |
  | `latest_assignee_at` | max `ticket_assignees.created_at` |
  | `latest_action` | `GREATEST(created_at, note_created_at, work_session_completed_at, completed_at, deleted_at, latest_assignee_at)`, converted to `Australia/Melbourne` |
  | `latest_action_type` | one of `Created` \| `Note Added` \| `Work Submitted` \| `Completed` \| `Deleted` \| `Assigned` \| `Unknown`, whichever timestamp equals `latest_action` |
  | `checklists` | JSON array of `{id, label, description, created_by, assigned_to_team, assigned_to_staff, scheduled, due, completed, completed_by, notes, created_at, updated_at, deleted_at, items: [{id, label, description, required, est_time, completed, actual_time, notes}]}` |
  | `tags` | JSON array of `{id, label, color}` |
  | `ticket_ref_with_check_digit` | aliased from `tickets.ticket_ref_full` |
  | `cold_storage`, `cold_storage_days` | date + computed days-remaining (null if not in cold storage or already elapsed) |
  | `assignee_photos` | JSON array of `{id, name, photo, assigned_staff_id, assigned_cc_id, is_team}` — `photo` starts `null` from SQL and is filled in with a full media URL in a PHP post-processing pass for staff assignees only |

  PHP-added fields after the query (not in the SQL at all):
  - `client_logo`: full media URL or `null`, batch-loaded per distinct `client_id` (2 extra queries total, not N+1 — a genuine effort was made here).
  - `assigned_staff_photo`: full media URL or `null`, same batch-loading.
  - `assignee_photos[].photo`: patched with a real URL for staff entries (team entries stay `null`).

- **Pagination**: manual `limit`/`page` → SQL `LIMIT`/`OFFSET`, total row count from
  a second, matching `COUNT(*)` query, returned as top-level `total`. **No `meta`,
  no `last_page`** — the app must compute pages itself from `total` and `limit`.
- **App notes**: `tickets` + `total` envelope (not a bare array — confirmed).
  Rows are raw SQL, not a stable Fractal contract; if columns are added/removed
  here it's a straight SQL edit, no transformer to check. Sort order is fixed
  server-side: current-user's-tickets first, then unassigned, then everyone
  else's, each bucket ordered by `latest_action DESC` — there is no `sort`/`order`
  param.

### `GET /api/clients/{client}/tickets`
`app/Http/Controllers/TicketController.php:480-914`. Same controller method
serves both this route and the (near-duplicate) top-level
`Route::get('tickets', ...)` registration inside the `clients/{client}` group —
they're the same code path.

- **Auth**: confirmed — **no authorization check of any kind**. No `Gate::allows`,
  no `canAccessClient`, nothing. Any authenticated staff token can list any
  client's tickets by ID even if that staff member has zero configured access to
  that client. This is stronger than "omits the access conditions `index()`
  builds" — there is *no* client-access or ticket-access filtering variable at
  all in this method, for anyone, sysadmin or not.
- **Query params**: `limit` (default 100), `page`, `search`, `completed` (`==
  "true"` compare, same as `index()`), `contact_id` (int — restricts to tickets
  where this client contact is an affected user).
- **Server-side search**: honoured; narrower than `index()`'s — matches ticket
  title, exact ticket ref (both forms), creating staff/contact name, affected
  users' names, assigned staff names. **Does not** search tags (unlike `index()`).
- **Response** `200` — same `{ "tickets": [...], "total": n }` envelope. Column
  set is **not identical** to `index()` — notable differences the app must not
  assume are interchangeable:
  - **Missing here vs. `index()`**: `ticket_level`, `assigned_team`, `note_created_at`,
    `assigned_cc` computed identically but via slightly different subquery shape (no
    functional difference), `assignee_photos[].photo` uses a raw relative media path
    string-concatenated with `env('APP_URL').'/storage'` rather than the media
    library's `getFullUrl()` — functionally similar but a different code path, worth
    knowing if `APP_URL` and the media disk's public URL ever diverge.
  - **Present here, not selected the same way in `index()`**: `ticket_ref_full`
    is selected directly (then also copied to `ticket_ref_with_check_digit` in PHP,
    same as `index()`'s SQL alias — same end result, different mechanism).
  - Everything else (`checklists`, `tags`, `creator_details`, `assigned_staff`,
    `assigned_staff_id`, `assigned_cc_id`, `assignee_count`, `assigned_staff_photo`,
    `latest_action`, `latest_action_type`, `note_type`, `cold_storage`,
    `cold_storage_days`, `override_time`, `calculated_time`, `session_count`,
    `latest_assignee_at`) matches `index()`'s semantics.
  - PHP-added: `client_logo` (single client's logo, looked up per-row via
    `Client::find()` — this **is** an N+1 if a page mixes many tickets, though
    since it's always the same client for this endpoint it resolves to one
    repeated cheap lookup, not truly N distinct queries).
- **Pagination**: same manual `limit`/`page`/`total` pattern as `index()`.
- **App notes**: treat this as a **different row shape** from `/api/tickets`, not
  the same shape pre-filtered by client — most importantly, **no `ticket_level`
  field is available here**, so a ticket-level chip on a per-client ticket list
  screen needs a separate call or a client-side join against `/api/tickets`.

### `GET /api/tickets/{id}` — the single ticket (body + notes) endpoint
`app/Http/Controllers/TicketController.php:916-929`, transformer
`app/Transformers/TicketTransformer.php`.

- **Auth**: `$user->canAccessTicket($ticket)` (`app/Models/Staff.php:225-254`).
  Fails → **403**: `{ "message": "You do not have access to this ticket." }`.
  Logic: sysadmin always passes; otherwise branches on `$user->ticket_access`:
  `all` → delegates to `canAccessClient($ticket->client_id)`; `assigned` → must be
  directly assigned to *this* ticket (client access is irrelevant in this branch —
  intentional, per the inline comment, so an assigned engineer isn't locked out
  by client-level gating); `none` → always false.
- **Query params**: none.
- **Loaded relations**: `affected_users`, `affected_assets`, `projects`, `tags`,
  `clientAssignees.clientContact`; fetched `withTrashed()` (a soft-deleted ticket
  is still viewable if found by ID and access passes).
- **Response** `200` — bare object, full shape (`TicketTransformer::transform`):
  ```json
  {
    "id": 501,
    "ticket_link": "abc123token",
    "title": "Printer offline",
    "body": "<p>signed-media-url HTML body</p>",
    "client_id": 12,
    "client": { "...": "every raw Client model column, plus a computed 'logo' key — see note below" },
    "client_contacts": [ "...ClientContactsTransformer shape (not the same as ClientContactTransformer above)..." ],
    "client_assets": [ "...ClientAssetsTransformer shape..." ],
    "ticket_ref": 501,
    "ticket_ref_with_check_digit": "501-4",
    "ticket_ref_full": 5014,
    "priority": "H",
    "source": "staff",
    "created_by_staff": 5,
    "created_by_staff_data": { "...": "..." },
    "created_by_staff_photo": "https://...",
    "created_by_client": null,
    "created_by_client_contact_data": null,
    "created_by_client_photo": null,
    "created_by_other": null,
    "sla_id": 2,
    "due": "2026-09-18T00:00:00.000000Z",
    "completed_by": null,
    "completed_by_staff": null,
    "completed_by_staff_photo": null,
    "completed_by_cc": null,
    "completed_by_cc_name": null,
    "created_at": "2026-09-04T01:00:00.000000Z",
    "updated_at": "2026-09-04T02:00:00.000000Z",
    "completed_at": null,
    "billable_time": { "bh": { "onsite": 0, "remote": 0 }, "ah": { "onsite": 0, "remote": 0 }, "eh": { "onsite": 0, "remote": 0 } },
    "latest_activity": "...",
    "affected_users": [
      {
        "id": 900,
        "client_contact_id": 44,
        "receive_comms": true,
        "reporter": true,
        "is_default": false,
        "client_contact_full_name": "Pat Smith",
        "client_contact_position": "Office Manager",
        "client_contact_phone": "+61...",
        "client_contact_email": "pat@accolade.com.au",
        "client_contact_photo": "https://..."
      }
    ],
    "affected_assets": [
      {
        "id": 700,
        "client_asset_id": 88,
        "asset_icon": "server",
        "asset_label": "SRV-01",
        "asset_label_code": "SRV",
        "rmm_asset": { "...": "..." }
      }
    ],
    "active_session": false,
    "files": [ "...FilesTransformer shape (media library files)..." ],
    "unbilled": true,
    "handling": "standard",
    "total_time": null,
    "ticket_assignees": [ "...raw TicketAssignee models..." ],
    "assignees": [
      { "id": 1, "staff_id": 5, "name": "Jo Doe", "email": "jo@accelit.com.au", "phone": "+61...", "photo": "https://...", "assigned_at": "2026-09-04T01:05:00Z", "type": "staff" }
    ],
    "client_assignees": [
      { "id": 2, "client_contact_id": 44, "name": "Pat Smith", "email": "pat@accolade.com.au", "phone": "+61..." }
    ],
    "unassignment_events": [ { "type": "unassigned", "data": { "name": "...", "photo": "...", "id": 9, "type": "staff" }, "date": "2026-09-01 10:00:00", "dateTime": "2026-09-01T10:00:00Z" } ],
    "assignment_history": [ { "type": "assigned", "data": { "...": "same shape as above" }, "date": "...", "dateTime": "..." } ],
    "notes": [
      {
        "id": 3001,
        "ticket_id": 501,
        "assigned_client_contact_id": null,
        "created_by_staff_photo": "https://...",
        "created_by_client_photo": null,
        "staff_id": 5,
        "client_contact": null,
        "body": "<p>signed-media-url HTML note body</p>",
        "created_at": "2026-09-04T01:10:00+10:00",
        "updated_at": "2026-09-04T01:10:00+10:00",
        "private": false,
        "systemnote": false
      }
    ],
    "work_sessions": [ "...TicketWorkSessionTransformer shape..." ],
    "checklist_instances": [ "...ChecklistInstanceTransformer shape..." ],
    "linked_projects": [ { "id": 9, "project_ref": "P-9", "label": "Office move", "priority": "N", "completed_at": null, "cancelled_at": null } ],
    "ticket_level": 2,
    "tags": [ { "id": 4, "msp_id": 1, "label": "Hardware", "color": "#00ff00" } ],
    "cold_storage": null
  }
  ```
- **`client` field gotcha (important)**: unlike every other endpoint in this
  document, `client` here is built as
  `array_merge($ticket->client->toArray(), ['logo' => ...])` — i.e. it dumps
  **every raw column on the `clients` table** (the `Client` model has no
  `$hidden`), not a curated transformer shape. That means it includes internal
  fields like `hudu_id` (the client's ID in the Hudu documentation/password
  system — see Credentials section), `msp_id`, `syncro_id`, timestamps, and
  `deleted_at`, alongside the friendly fields. It will **not** match the shape
  of `GET /api/clients/{id}`'s `ClientTransformer` output (different key set,
  e.g. no `access_controlled`-driven gating, no `address_books`).
  `created_at`/`note timestamps inside `notes[]`` are converted to the
  **client's own timezone** (`Timezone::convert`), whereas the top-level ticket
  `created_at`/`completed_at`/etc. are left as raw UTC Carbon serialization —
  two different timestamp conventions in the same payload.
- **Pagination**: n/a (single resource) — but note `notes`, `affected_users`,
  `work_sessions`, etc. are unbounded arrays with no pagination of their own; a
  ticket with years of history returns its entire note thread in one response.
- **App notes**: this is the heaviest single-resource payload in the API. Expect
  large bodies on long-lived tickets. Don't reuse the nested `client` object as a
  stand-in for `GET /api/clients/{id}` — different shape entirely.

---

## Assets

### `GET /api/clients/{client}/assets` (and, identically, `GET /api/assets`)
`app/Http/Controllers/ClientAssetController.php:20-76`, transformer
`app/Transformers/ClientAssetTransformer.php`. **Both routes point at the exact
same controller method, `index(Request $request)`.**

- **Critical routing gotcha**: `index()` does **not** accept a `$client` method
  parameter, so when hit via `/api/clients/{client}/assets`, Laravel simply
  discards the `{client}` route segment — **it is never read**. The only way to
  scope by client on this endpoint is the query parameter `client_id`. Hitting
  `GET /api/clients/12/assets` with no `?client_id=12` returns assets for
  **every** client the user can access, not just client 12. The app must always
  pass `client_id` as a query param, and should probably just call `/api/assets`
  directly with `client_id` rather than relying on the path segment implying scope.
- **Auth**: `Gate::allows('access-assetlist')` → `$user->sysadmin ||
  $user->permission_assetlist`. Fails → **403** `{"message": "Unauthorized."}`.
- **Query params actually read**: `all` (boolean-ish, PHP-truthy gotcha applies —
  `"false"` is truthy), `show_deleted` (same gotcha, includes soft-deleted via
  `withTrashed()`), `client_id`, `site_id`, `search` (split on whitespace into
  terms, OR'd together, matched only against `label` via `ILIKE` — does **not**
  search description, serial number, or site/contact name), `limit` (default 25,
  only relevant when `all` is falsy).
- **Access scoping**: non-sysadmin restricted to `whereIn('client_id',
  $user->getAccessibleClientIds())`.
- **Two structurally different response shapes on the same endpoint**:
  - `all` truthy → bare array (`->toArray()['data']`), every matching asset, no
    pagination:
    ```json
    [ { "id": 88, "client_id": 12, "client_name": "Accolade Screens", "logo": "https://...", "site_id": 3, "label": "SRV-01", "description": "Primary file server", "msi_id": 23, "serial_no": "SN123", "asset_label_id": 4, "asset_label": {"...":"..."}, "assigned_to": 44, "acquired": "2022-01-01", "disposed": null, "purchase_price": 2500.0, "residual_value": 200.0, "est_lifespan": 5, "site": {"...":"raw ClientSite model"}, "contact": {"...":"raw ClientContact model"}, "rmm_asset": {"...":"RMMAssetsTransformer shape"}, "tickets": [ "...ClientAssetAffectedTicketsTransformer shape..." ], "icon": "server", "msi_icon": "server-icon", "hand_up": false, "deleted_at": null } ]
    ```
  - `all` falsy/absent → **Fractal's paginated envelope**, `->toArray()` (not
    `['data']` — the only asset/ticket/client endpoint in this document that
    returns the full Fractal pagination envelope rather than unwrapping it):
    ```json
    {
      "data": [ "...same row shape as above..." ],
      "meta": {
        "pagination": {
          "total": 143,
          "count": 25,
          "per_page": 25,
          "current_page": 1,
          "total_pages": 6,
          "links": { "next": "https://.../api/assets?page=2" }
        }
      }
    }
    ```
    Standard Laravel `page` query param selects the page (Fractal's
    `IlluminatePaginatorAdapter` reads it from the paginator, which reads
    `request('page')` internally — there's no separate `page` param wired
    explicitly in this controller, it's implicit Laravel pagination behavior).
- **App notes**: this is the only endpoint in the whole set with a real
  `meta.pagination` block — everything else that paginates does it by hand with
  a bespoke `{tickets/invoices, total}` shape. Branch client-side on whether
  `all` was requested to know which envelope shape to parse. Also: passing
  `all=false` literally still triggers the "all" (unpaginated) branch — see the
  cross-cutting boolean gotcha at the top of this document.

### `GET /api/assets/onboarding`
`app/Http/Controllers/ClientAssetCreationHistoryController.php:16-38`,
transformer `app/Transformers/App/ClientAssetCreationHistory/ClientAssetCreationHistoryTransformer.php`.
Different controller entirely from `/api/assets` — do not confuse the two "assets" endpoints.

- **Auth**: **none** — the `Gate::allows('manage-assets-onboarding')` check is
  present in the source but **commented out** (`// if (!Gate::allows(...))`).
  Any authenticated staff token gets this regardless of the
  `manage-assets-onboarding` gate (which is sysadmin-only when it *is* enforced
  elsewhere, e.g. presumably on the `store` side or the admin UI's route guard —
  but not on this GET).
- **Query params**: none read.
- **What it returns**: the latest onboarding-history row **per unique
  `computername`** (a join against a `MAX(created_at)` subquery, so it's not "all
  onboarding history," it's "most recent event for each machine name ever seen").
- **Response** `200`:
  ```json
  {
    "assets": [
      {
        "id": 9001,
        "client_asset_prefix": "ACC",
        "label_code": "SRV",
        "computername": "ACC-SRV-01",
        "prev_computername": null,
        "username": "localadmin",
        "localadmin_pw": "Str0ngP@ss!",
        "wan_ip": "203.0.113.9",
        "created_at": "2026-08-01T00:00:00Z",
        "updated_at": "2026-08-01T00:00:00Z",
        "client_name": "Accolade Screens"
      }
    ]
  }
  ```
- **App notes**: `assets` envelope (not bare array), but **contains a plaintext
  local-admin password (`localadmin_pw`) per row, with zero authorization gate**.
  This is the single worst secret-exposure finding in this document — see Gaps.

---

## Credentials

### `GET /api/clients/{client}/passwords`
`app/Http/Controllers/ClientPasswordController.php:13-63`. **Not a database
query at all** — this shells out to a Python script
(`auto_scripts/hudu_getpws.py`) that calls the third-party Hudu documentation
platform's REST API and prints JSON to stdout, which the controller passes
through almost verbatim.

- **Auth**: **none whatsoever.** No `Gate::allows`, no `canAccessClient`, no
  ability check beyond the route group's blanket `auth:sanctum` +
  `token.can:*`. Any staff member with a valid full-ability token can fetch any
  client's passwords by ID, regardless of client access settings, `sysadmin`,
  `permission_*` flags, or anything else.
- **Query params**: none — only the `{client}` path segment, used to look up
  `Client::findOrFail($client)->hudu_id`.
- **If the client has no `hudu_id` set** → `200`, bare empty array: `[]`.
- **If the shell command fails or throws** → also `200`, bare empty array: `[]`
  (errors are logged server-side via `Log::error`, never surfaced to the caller).
  **The app cannot distinguish "this client genuinely has zero passwords" from
  "the Hudu integration is broken/misconfigured/down" — both look like `[]`.**
- **Success response shape — confirmed from `auto_scripts/hudu_getpws.py`,
  `fetch_passwords()`**: a **JSON object keyed by password ID as a string**, **not
  an array**:
  ```json
  {
    "33": { "id": 33, "company_id": 12, "name": "MS 365 - accounts@accolade.com.au", "username": "accounts@accolade.com.au", "password": "plaintext-password-here", "otp": "482913", "description": "..." },
    "29": { "id": 29, "company_id": 12, "name": "Accolade NAS", "username": "admin", "password": "plaintext-password-here", "otp": "", "description": "" }
  }
  ```
  `otp` is a **live, freshly-generated TOTP code** (computed server-side at
  request time from a stored `otp_secret` via `pyotp`), not a static field — it
  changes every ~30s and will be stale by the time the app renders it if there's
  any meaningful network latency.
- **App notes**: this is a JS **object**, not an array — `Object.values(...)` or
  iterate by key, don't `.map()` over it expecting an array. A field engineer's
  app should be able to see these (that's presumably the whole point of a staff
  app hitting this endpoint), but be aware there's no server-side scoping at all
  — client-side UI restriction is the *only* thing standing between "logged in
  staff" and "every client's every password," which the app's own screens must
  not undermine (e.g. don't expose a raw "fetch by client_id" debug path).

### `GET /api/clients/{client}/passwords/{id}`
`app/Http/Controllers/ClientPasswordController.php:65-103`. Same script, `fetch_pw()` mode.

- **Auth**: **none**, same as above. Additionally, **the `{client}` path segment
  is completely ignored** by this method too (its signature is
  `show(Request $request)`, no `$client` param) — only `{id}` (the Hudu password
  ID) is used. There is **no check that password `{id}` actually belongs to
  client `{client}`** — the URL's client segment is decorative. Any staff member
  who can guess or enumerate a password ID can fetch it via any client's URL
  prefix, or omit the relationship entirely.
- **Query params**: none.
- **Failure modes**: same as index — script failure or non-JSON output → `200`,
  bare `[]` (note: a *single-item* endpoint degrading to an *empty array* on
  failure, which is a shape change, not just an empty result).
- **Success response** — bare flat object (`fetch_pw()`):
  ```json
  {
    "id": 33,
    "company_id": 12,
    "name": "MS 365 - accounts@accolade.com.au",
    "username": "accounts@accolade.com.au",
    "password": "plaintext-password-here",
    "otp": "482913",
    "description": "..."
  }
  ```
- **App notes**: same live-OTP caveat as above. Note the response shape
  literally changes type (object → array) on error vs success — the app must
  check for an `id` key (or just try/catch on `.id`) rather than assuming a
  consistent object shape.

---

## Directory and money

### `GET /api/address-book`
`app/Http/Controllers/AddressBookController.php:14-102`.

- **Auth**: `Gate::allows('access-addressbook')` → `$user->sysadmin ||
  $user->permission_addressbook`. Fails → **403** `{"message": "Unauthorized."}`.
- **Query params**: none read.
- **Access scoping**: non-sysadmin restricted via `c.id IN (accessible client
  ids)` applied to both the `client_contact_rows` and `client_rows` CTEs; general
  contacts (`client_id IS NULL`) are never access-restricted (always visible to
  anyone who passes the gate) since they aren't tied to any client.
- **Response** `200` — **bare JSON array** (raw `DB::select` rows, no
  transformer), union of three "kinds" of row distinguished by `type`:
  ```json
  [
    { "type": "client_contact", "displayname": "Pat Smith", "contact_id": 44, "client_id": 12, "fname": "Pat", "sname": "Smith", "client_name": "Accolade Screens", "email": "pat@accolade.com.au", "phone": "+61..." },
    { "type": "general_contact", "displayname": "Vendor Support", "contact_id": 90, "client_id": null, "fname": "Vendor", "sname": "Support", "client_name": null, "email": "support@vendor.com", "phone": "+61..." },
    { "type": "client", "displayname": "Accolade Screens", "contact_id": null, "client_id": 12, "fname": null, "sname": null, "client_name": "Accolade Screens", "email": "info@accolade.com.au", "phone": "+61..." }
  ]
  ```
  Only rows with a non-null `email` OR `phone` are included at all (filtered in SQL).
- **Pagination**: none — full result set, ordered by `displayname`.
- **App notes**: bare array, three row "types" interleaved — branch UI rendering
  on `type`. No search param exists server-side; client-side filtering is the
  only option for a search box.

### `GET /api/invoices`
`app/Http/Controllers/ClientInvoiceController.php:26-39` →
`app/Repositories/App/ClientInvoiceRepository.php` (`getGlobalInvoices` /
`getClientProfileInvoices`).

- **Auth**: `Gate::allows('manage-client-account')` → **`$user->sysadmin`
  only** (`app/Providers/AuthServiceProvider.php:28-30` — this gate is a plain
  `return $user->sysadmin;`, no `permission_*` escape hatch like addressbook/assets
  have). Fails → **403** `{"message": "Unauthorized."}`. **A non-sysadmin field
  engineer will 403 on this endpoint every single time, unconditionally** — there
  is no partial-access mode for invoices at all.
- **`clientId` param** (confirmed, and it's a query param, not a route segment —
  the URL is always `/api/invoices`, never `/api/invoices/{client}`): if present
  and truthy, calls `getClientProfileInvoices($clientId, ...)` (scoped to one
  client); if absent, calls `getGlobalInvoices(...)` (every client). Both return
  the **same envelope shape**, just scoped differently.
- **Other query params read** (both branches): `limit` (default 25), `page`,
  `search` (matches client name, invoice reference, or Xero invoice number —
  `LIKE`, case-insensitive), `overdueOnly` (bool via `filter_var(...,
  FILTER_VALIDATE_BOOLEAN)` — this one **is** parsed safely, unlike the
  assets/contacts endpoints), `ageBand`, `dateFrom`/`dateTo` (`Y-m-d`; presence of
  either date param **changes the SQL** — the "must be overdue" constraint is
  dropped whenever explicit dates are given, on the assumption the caller wants
  a specific window, not just "what's currently overdue"). Global-only: `projectId`.
- **Response** `200` — bare envelope (not Fractal, raw SQL rows):
  ```json
  {
    "invoices": [
      {
        "invoice_id": 501,
        "client_id": 12,
        "client_name": "Accolade Screens",
        "reference": "INV-2026-0501",
        "approved": true,
        "issued": "2026-08-01",
        "due": "2026-08-31",
        "paid": null,
        "uuid": "a1b2c3d4-...",
        "voided": null,
        "contract_id": 3,
        "start_at": "2026-08-01",
        "end_at": "2026-08-31",
        "next_invoice": "2026-09-01",
        "xero_invoice_ref": "XR-501",
        "xero_invoice_no": "INV-0501",
        "total_price": 1200.0,
        "total_price_gst": 120.0,
        "total_with_gst": 1320.0,
        "prices_incl_gst": false,
        "payment_status": "none",
        "latest_payment_initiated": null
      }
    ],
    "total": 84
  }
  ```
  (`getGlobalInvoices` and `getClientProfileInvoices` select the identical column
  list — the only structural differences between the two branches are the extra
  `client_id = :clientId` filter on the per-client one, and the absence of the
  `projectId` filter option there.)
- **Pagination**: manual `limit`/`page`/`total`, same bespoke pattern as tickets
  — no `meta`, compute pages from `total`/`limit` client-side. Passing `limit=-1`
  on **any** of this repository's methods (`getGlobalInvoices`,
  `getClientProfileInvoices`, `getGlobalPayments`, `getArLeaderboard`) disables
  the `LIMIT`/`OFFSET` clause entirely and returns every matching row in one
  response — useful to know, dangerous to use blindly against a large dataset.
- **App notes**: this whole endpoint (and its siblings `arLeaderboard`,
  `accountsReceivableAging`, `payments` under the same `invoices` prefix, same
  gate) is **sysadmin-only**. If the React Native app is meant for field
  engineers rather than office/admin staff, do not build any invoice/billing
  screen against this API — it will 403 for the entire target audience.

---

## Gaps the app must work around

In priority order — most dangerous / most likely to break the app first:

1. **Credentials endpoints have zero authorization.**
   `GET /api/clients/{client}/passwords` and
   `GET /api/clients/{client}/passwords/{id}` have no `Gate::allows`, no
   `canAccessClient`, nothing beyond "has a valid full-ability token." Any staff
   member can read any client's plaintext passwords (and live TOTP codes) by ID.
   The `{client}` segment on the single-password route is not even checked
   against the password's actual owner. If this app is meant to restrict which
   engineers see which clients' credentials, that restriction **must** be
   enforced client-side (or a backend change requested) — there's nothing to
   lean on server-side today.

2. **`GET /api/assets/onboarding` leaks plaintext local-admin passwords, also
   with no authorization.** The `manage-assets-onboarding` gate check is
   commented out in the controller. `localadmin_pw` comes back in the clear for
   every onboarding record, to any authenticated staff member.

3. **`GET /api/clients/{client}/tickets` and `GET /api/clients/{client}/sites`
   have no authorization check at all.** Any staff token can list any client's
   tickets or sites by ID regardless of that staff member's configured client
   access. `GET /api/tickets` (the global list) *does* enforce access
   server-side in its `WHERE` clause — but the per-client variant and the sites
   endpoint don't. If the app relies on "the server won't show me clients I
   shouldn't see," that assumption holds for `/api/clients`, `/api/clients/{id}`,
   `/api/tickets`, and asset/passwords-by-client-id-if-called-with-a-known-id
   is unenforced too — but specifically breaks down for tickets-by-client and
   sites-by-client.

4. **`GET /api/invoices` (and its siblings) 403 unconditionally for non-sysadmin
   users.** If field engineers are the target audience, don't build any
   billing/AR UI against this API — there's no partial-access mode.

5. **`GET /api/clients/{client}/assets` silently ignores the `{client}` path
   segment.** The controller method never declares a `$client` parameter; only
   the `client_id` **query** parameter has any effect. Calling the "scoped"
   route without the query param returns assets across every accessible client.
   This is an easy, silent bug to introduce in the app if someone assumes the
   REST-looking path implies server-side scoping.

6. **No pagination on several endpoints that can grow large**: `GET
   /api/clients` (all accessible clients in one array), `GET
   /api/clients/{client}/contacts`, `GET /api/clients/{client}/sites`, `GET
   /api/address-book`, `GET /api/assets/onboarding` (dedup'd per-computername,
   but still unbounded), and every field inside a single ticket's `notes`,
   `work_sessions`, `affected_users`, etc. on `GET /api/tickets/{id}`. Large
   clients/tickets will mean large payloads with no way to page them down.

7. **`search` is silently ignored** on `GET /api/clients`, `GET
   /api/address-book`, and effectively on `GET /api/clients/{client}/contacts`
   /`GET /api/clients/{client}/sites` (no search param exists there at all). If
   the SPA sends `search`, don't assume the API is filtering — verify results
   client-side or filter client-side yourself.

8. **Two different pagination conventions in the same API**: Fractal's
   `meta.pagination` envelope (assets, when not `all=1`) vs. a bespoke
   `{resource_key, total}` shape (tickets, invoices) vs. no pagination at all
   (everything else). The app needs per-endpoint handling, not one shared
   pagination parser.

9. **Inconsistent "no data" representations**: `/api/me`'s
   `active_work_session` is `{}`/`[]` rather than `null` when there's no active
   session; the passwords endpoints degrade from an object/array to a bare `[]`
   on any internal failure, indistinguishable from "genuinely nothing here."
   Treat both forms as "empty," and don't use shape (object vs array) as a
   signal of success for the passwords endpoints — check for expected keys
   instead.

10. **Boolean query parameters are PHP-truthy, not JSON-boolean, on several
    endpoints** (`ClientContactController::index`'s `all`/`show_deleted`,
    `ClientAssetController::index`'s `all`/`show_deleted`). Sending the literal
    string `"false"` turns these flags **on**. Omit the parameter to get the
    default/off behavior; never send `?flag=false`.

11. **`GET /api/tickets` vs `GET /api/clients/{client}/tickets` return
    different column sets** for what looks like the same "ticket row" shape
    (notably `ticket_level` is missing from the per-client variant). Don't
    write one shared row-mapper for both — they need separate types/interfaces
    on the client.

12. **`GET /api/tickets/{id}`'s `client` field is a raw, untransformed dump of
    every `clients` table column** (no `$hidden` on the `Client` model),
    different from the curated `ClientTransformer` shape used by `GET
    /api/clients/{id}`. It also incidentally exposes `hudu_id`, the identifier
    used by the (unauthenticated) passwords endpoints — not itself exploitable
    without also having a valid staff token, but worth knowing it's in there.

13. **Two distinct login-failure 403 bodies exist for the same "your IP isn't
    whitelisted" condition** (`ip.whitelist` middleware vs. the in-controller
    check in `AuthController::login`), and one 400-with-an-`error`-key outlier
    (`switch-mfa-method`) among an API that otherwise always uses
    `message`/`errors`. Error-body parsing should be defensive
    (check for `message`, `errors`, or `error`) rather than assuming one shape.
