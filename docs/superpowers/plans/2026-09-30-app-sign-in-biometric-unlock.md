# Separate App Sessions and Biometric Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop app and web sign-ins from ending each other, keep the app signed in for 30 days behind Face ID / fingerprint, and remember the email on the login form.

**Architecture:**
- **Backend (`accelit`):**
  - Every Sanctum token gets its own `expires_at`.
  - The staff app identifies itself with `X-Accel-Client: staff-app` and gets its own token kinds: `staff_app`, plus an address-book-only `staff_app_contacts`.
  - Sign-in revokes only tokens of the same kind.
- **App (`accelit-staffapp`):**
  - A new `session` service is the only holder of the app token: in memory while unlocked, and at rest in `expo-secure-store` with `requireAuthentication`.
  - Pure rules decide routing and locking.
  - A new unlock screen does the biometric prompt.
  - The login form remembers the email.

**Tech Stack:**
- Laravel 10.50, Sanctum 3.3.3, PHPUnit.
- Expo SDK 54, React Native 0.81, expo-router 6, Vitest 2.
- `expo-secure-store` ~15.0.8, `expo-local-authentication` ~17.0.9.

**Spec:** `docs/superpowers/specs/2026-09-30-app-sign-in-biometric-unlock-design.md` (in `accelit-staffapp`)

## Global Constraints

**Repos and branches**
- Two repos, three places:
  - Backend tasks 1–3 run in a new worktree, `/Users/anelkujovic/Documents/Projects/accelit--app-sessions`, on branch `feat/app-sessions` cut from `origin/dev` (backend CLAUDE.md §2).
  - App tasks 4–10 run in `/Users/anelkujovic/Documents/Projects/accelit-staffapp` on the existing branch `feat/app-sign-in-biometric-unlock`.

**Commits**
- Backend commit messages: `type: summary`, lowercase imperative, **no `Co-Authored-By` trailer and no generated-with footer** (backend CLAUDE.md §1).
- App commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`, as this repo's history does.
- Never `git push`, never deploy. The user tests first.

**Backend tests**
- Run them with `DB_DATABASE=accelit_database php artisan test --filter=<Class>`.
  - The existing feature tests run against the dev database inside `DatabaseTransactions`.
  - `phpunit.xml`'s `testing` database does not exist, and `accelit_testing` is empty and 11 migrations behind.
- Every new backend test class uses `DatabaseTransactions`.
- Never run `migrate:fresh`, or `migrate` against anything.
- Backend formatting: `./vendor/bin/pint --dirty` before each backend commit.

**Header and token names**
- Header: `X-Accel-Client: staff-app`. No other value means "app".
- Token names:
  - `auth_token` (web, and impersonation);
  - `staff_app` (abilities `['*']`);
  - `staff_app_contacts` (abilities `['address-book']`);
  - `token` (OTP stub, abilities `['otp']`).

**Lifetimes**
- `sanctum.expiration` → `null`.
- `sanctum.default_token_minutes` = `600`.
- `sanctum.staff_app_token_days` = `30`.

**App lock**
- 5 minutes (`LOCK_AFTER_MS = 300000`).
- The clock starts only on AppState `background`, never on `inactive`.

**Storage**
- SecureStore key `staffAppSession`, with options `{ requireAuthentication: true, authenticationPrompt: 'Unlock Accel Staff' }` on every get, set and delete.
- AsyncStorage keys:
  - `sessionMarker`;
  - `lastEmail`;
  - `mfaDeviceToken` (unchanged);
  - `webSessionToken` (web only);
  - legacy `authToken`, which is only ever deleted.

**Copy, verbatim**
- `Your session expired — sign in again.`
- `{Label} changed on this phone — sign in with your password.`
- `Couldn't unlock. Try again, or sign in with your password.`
- `Sign in with password`
- `Unlock with {label}`
- Face ID usage text: `Accel Staff uses Face ID to unlock your session.`

**Versions and style**
- `app.json`: `version` and `runtimeVersion` go from `1.0.0` to `1.1.0`.
- App JS style: 4-space indent, single quotes, semicolons. Comments explain *why*, as in `app/services/api.js`.

## Review Focus

1. **Two unlock prompts on one open.** React StrictMode's double effect, or an effect re-run, could start a second SecureStore read while the first prompt is up. Android rejects it with "Authentication is already in progress", which would show "Couldn't unlock" over a live prompt. Expect exactly one prompt per open. Pinned in Task 6.
2. **The iOS Face ID sheet makes the app `inactive`.** If that counted as time away, the app could lock itself while unlocking. Expect: `inactive` never starts the clock. Pinned in Task 8.
3. **"Sign in with password", then backing out of the code step.** The locked session must survive, so the next open still offers Face ID. Pinned in Task 4 (`routeFor` leaves auth screens alone while locked) and Task 7 (`abandonOtp` leaves the session).
4. **A refused biometric write on a phone that already had a stored session.** The old marker must not outlive the item it described, or the next open would wrongly say "Face ID changed". Pinned in Task 5.
5. **A 30-day token that died while the app was locked.** After unlocking, the first request's 401 must delete the stored copy too, or every open prompts Face ID for a dead token. Pinned in Task 7.

## File Structure

**Backend (`accelit--app-sessions` worktree)**

| Path | Change | Responsibility |
|---|---|---|
| `config/sanctum.php` | modify | `expiration` → `null`; add `default_token_minutes`, `staff_app_token_days` |
| `app/Providers/AppServiceProvider.php` | modify | default `expires_at` on create; 600-minute rule for pre-deploy tokens |
| `app/Console/Kernel.php` | modify | daily prune of pre-deploy tokens |
| `app/Helpers/AuthHelper.php` | modify | token-kind constants; `issueSessionTokens()` |
| `app/Http/Controllers/AuthController.php` | modify | `login()`, `checkOTP()`, `logout()` |
| `routes/app/api.php` | modify | address-book guard; broadcasting guards |
| `tests/Feature/TokenExpiryTest.php` | create | |
| `tests/Feature/AppSessionTokensTest.php` | create | |

**App (`accelit-staffapp`)**

| Path | Change | Responsibility |
|---|---|---|
| `app/utils/sessionRules.js` | create | pure: lock timing, expiry, routing, unlock-failure reading, labels, messages |
| `app/services/session.js` | create | the only holder of the `staff_app` token |
| `app/(auth)/unlock.js` | create | the unlock screen |
| `app/utils/appLock.js` | create | AppState listener and `useAppLock` hook |
| `app/constants/storageKeys.js` | modify | |
| `app/services/api.js` | modify | |
| `app/utils/authFlow.js` | modify | |
| `app/utils/contactSync.js` | modify | comment only |
| `app/_layout.js` | modify | |
| `app/index.js` | modify | |
| `app/(auth)/login.js` | modify | |
| `app/(auth)/otp.js` | modify | |
| `app/(auth)/vpn.js` | modify | |
| `app.json`, `package.json`, `package-lock.json` | modify | |
| `tests/sessionRules.test.js`, `tests/session.test.js`, `tests/unlockScreen.test.js`, `tests/authFlow.test.js`, `tests/appLock.test.js`, `tests/loginScreen.test.js` | create | |
| `tests/api.test.js`, `tests/rootLayout.test.js` | modify | |
| `README.md`, `docs/api-contract.md` | modify | |
| `docs/biometric-unlock-verification.md` | create | |

`app/components/LogoutButton.js` does not change: it already calls `clearAuth()`, which will now end the session.

---

## Part A — Backend (`accelit`)

### Task 1: Each Sanctum token carries its own expiry

**Files:**
- Modify: `config/sanctum.php:40-49`
- Modify: `app/Providers/AppServiceProvider.php` (`boot()`, imports)
- Modify: `app/Console/Kernel.php` (`schedule()`, imports)
- Test: `tests/Feature/TokenExpiryTest.php`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `config('sanctum.default_token_minutes')` (int 600) and `config('sanctum.staff_app_token_days')` (int 30).
  - Any `createToken($name, $abilities)` call without a third argument gets `expires_at = now + 600 min`.
  - `createToken($name, $abilities, $expiresAt)` keeps `$expiresAt`.
  - A row with `expires_at = null` authenticates only while `created_at` is under 600 minutes old.

- [ ] **Step 0: Create the worktree**

```bash
cd /Users/anelkujovic/Documents/Projects/accelit
git fetch origin
git worktree add ../accelit--app-sessions -b feat/app-sessions origin/dev
cd ../accelit--app-sessions
cp ../accelit/.env .env
composer install
```

Expected: `composer install` finishes. `git status` is clean apart from the untracked `.env`, which is gitignored.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/TokenExpiryTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Staff;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class TokenExpiryTest extends TestCase
{
    use DatabaseTransactions;

    private function staff(): Staff
    {
        return Staff::create([
            'msp_id' => DB::table('msps')->value('id'),
            'fname' => 'Token',
            'sname' => 'Expiry',
            'email' => 'token-expiry-'.Str::lower(Str::random(8)).'@example.test',
            'password' => bcrypt('correct-horse-battery'),
        ]);
    }

    // The sanctum guard keeps the user it resolved for the rest of the test,
    // so each request starts from a clean slate.
    private function me(string $plainTextToken): TestResponse
    {
        $this->app['auth']->forgetGuards();

        return $this->getJson(config('app.admin_url').'/api/me', ['Authorization' => 'Bearer '.$plainTextToken]);
    }

    public function test_a_token_created_without_an_expiry_gets_the_default_lifetime(): void
    {
        $this->freezeSecond();

        $token = $this->staff()->createToken('auth_token');

        $this->assertNotNull($token->accessToken->expires_at);
        $this->assertTrue($token->accessToken->expires_at->equalTo(now()->addMinutes(600)));
    }

    public function test_an_explicit_expiry_is_kept(): void
    {
        $this->freezeSecond();

        $token = $this->staff()->createToken('staff_app', ['*'], now()->addDays(30));

        $this->assertTrue($token->accessToken->expires_at->equalTo(now()->addDays(30)));
    }

    public function test_a_token_past_its_expiry_is_rejected(): void
    {
        $token = $this->staff()->createToken('auth_token');
        $token->accessToken->forceFill(['expires_at' => now()->subMinute()])->save();

        $this->me($token->plainTextToken)->assertStatus(401);
    }

    public function test_a_long_lived_token_outlives_the_old_global_window(): void
    {
        $token = $this->staff()->createToken('staff_app', ['*'], now()->addDays(30));
        $token->accessToken->forceFill(['created_at' => now()->subDays(3)])->save();

        $this->me($token->plainTextToken)->assertOk();
    }

    public function test_a_token_issued_before_the_change_keeps_the_600_minute_rule(): void
    {
        $fresh = $this->staff()->createToken('auth_token');
        $fresh->accessToken->forceFill(['expires_at' => null, 'created_at' => now()->subMinutes(599)])->save();

        $this->me($fresh->plainTextToken)->assertOk();

        $stale = $this->staff()->createToken('auth_token');
        $stale->accessToken->forceFill(['expires_at' => null, 'created_at' => now()->subMinutes(601)])->save();

        $this->me($stale->plainTextToken)->assertStatus(401);
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `DB_DATABASE=accelit_database php artisan test --filter=TokenExpiryTest`

Expected: two failures.
- `test_a_token_created_without_an_expiry_gets_the_default_lifetime`: `expires_at` is null.
- `test_a_long_lived_token_outlives_the_old_global_window`: 401, because the global 600-minute rule still applies.

The other three pass already. They guard behaviour that must not change.

- [ ] **Step 3: Make expiry per-token**

In `config/sanctum.php`, replace the `'expiration' => 600,` line with:

```php
    'expiration' => null,

    // Lifetime of a token created without an explicit expires_at: web
    // sign-ins, impersonation, OTP stubs, the client portal. Applied on create
    // in AppServiceProvider::boot(), which also holds tokens minted before this
    // setting existed (expires_at null) to the same number of minutes.
    'default_token_minutes' => 600,

    // Lifetime of the staff app's tokens (AuthHelper::issueSessionTokens()).
    'staff_app_token_days' => 30,
```

Add a line to the docblock above `expiration`, directly under
`| not expire. This won't tweak the lifetime of first-party sessions.`:

```php
    | Null here: every token carries its own expires_at (see below).
```

In `app/Providers/AppServiceProvider.php`, add these imports beside the others:

```php
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;
```

and in `boot()`, directly after `TicketAffectedUser::observe(TicketAffectedUserObserver::class);`, add:

```php
        // Each token carries its own expires_at, so staff-app tokens can outlive
        // web ones. A token created without one gets the web lifetime.
        PersonalAccessToken::creating(function (PersonalAccessToken $token) {
            $token->expires_at ??= now()->addMinutes(config('sanctum.default_token_minutes'));
        });

        // Tokens minted before per-token expiry have no expires_at. Hold them to
        // the old global rule rather than letting them live forever.
        Sanctum::authenticateAccessTokensUsing(function (PersonalAccessToken $token, bool $isValid) {
            return $isValid && ($token->expires_at !== null
                || $token->created_at->gt(now()->subMinutes(config('sanctum.default_token_minutes'))));
        });
```

In `app/Console/Kernel.php`, add the import `use Laravel\Sanctum\PersonalAccessToken;`. Then, directly after the existing `sanctum:prune-expired` block, add:

```php
        // sanctum:prune-expired only looks at expires_at now. Tokens minted
        // before per-token expiry have none, so prune those by age, as it did.
        $schedule->call(fn () => PersonalAccessToken::whereNull('expires_at')
            ->where('created_at', '<', now()->subMinutes(config('sanctum.default_token_minutes'))->subHours(24))
            ->delete())
            ->name('sanctum:prune-legacy-tokens')
            ->daily()
            ->withoutOverlapping()
            ->onOneServer();
```

- [ ] **Step 4: Run the tests and the schedule check**

Run: `DB_DATABASE=accelit_database php artisan test --filter=TokenExpiryTest`
Expected: 5 passed.

Run: `DB_DATABASE=accelit_database php artisan test --filter='UnauthenticatedApiResponseTest|GlobalRecommendationsListTest'`
Expected: all passed. These are the existing auth-adjacent tests.

Run: `php artisan schedule:list | grep -i prune`
Expected: both `sanctum:prune-expired --hours=24` and `sanctum:prune-legacy-tokens` are listed as daily.

- [ ] **Step 5: Format and commit**

```bash
./vendor/bin/pint --dirty
git add config/sanctum.php app/Providers/AppServiceProvider.php app/Console/Kernel.php tests/Feature/TokenExpiryTest.php
git commit -m "feat: give each sanctum token its own expiry" -m "Staff app tokens are about to live 30 days while web tokens keep 600
minutes, which the single global expiration cannot express. Tokens
issued before this change have no expires_at and keep the old rule."
```

---

### Task 2: App and web sign-ins get separate token kinds

**Files:**
- Modify: `app/Helpers/AuthHelper.php`
- Modify: `app/Http/Controllers/AuthController.php` (`login()` trusted-device and no-MFA branches; `checkOTP()`)
- Test: `tests/Feature/AppSessionTokensTest.php`

**Interfaces:**
- Consumes (Task 1): `config('sanctum.staff_app_token_days')`, and per-token `expires_at` from the third `createToken()` argument.
- Produces:
  - Constants `AuthHelper::STAFF_APP_CLIENT = 'staff-app'`, `AuthHelper::WEB_TOKEN = 'auth_token'`, `AuthHelper::APP_TOKEN = 'staff_app'`, `AuthHelper::APP_CONTACTS_TOKEN = 'staff_app_contacts'`.
  - `AuthHelper::issueSessionTokens(Staff $user, Request $request): array`, returning:
    - web: `['token' => string]`;
    - app: `['token' => string, 'contacts_token' => string, 'expires_at' => ISO-8601 string]`.
  - `POST /api/login` and `POST /api/check-otp` responses include those keys.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/AppSessionTokensTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Staff;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class AppSessionTokensTest extends TestCase
{
    use DatabaseTransactions;

    private const PASSWORD = 'correct-horse-battery';

    private const APP = ['X-Accel-Client' => 'staff-app'];

    private function staff(array $attributes = []): Staff
    {
        return Staff::create([
            'msp_id' => DB::table('msps')->value('id'),
            'fname' => 'App',
            'sname' => 'Session',
            'email' => 'app-session-'.Str::lower(Str::random(8)).'@example.test',
            'password' => bcrypt(self::PASSWORD),
            ...$attributes,
        ]);
    }

    // The sanctum guard keeps the user it resolved for the rest of the test,
    // and withToken()/withHeaders() would leak into later requests, so every
    // request passes its own headers and starts from a clean guard.
    private function send(string $method, string $path, ?string $token = null, array $headers = [], array $data = []): TestResponse
    {
        $this->app['auth']->forgetGuards();

        if ($token) {
            $headers['Authorization'] = 'Bearer '.$token;
        }

        return $this->json($method, config('app.admin_url').'/api/'.$path, $data, $headers);
    }

    private function login(Staff $staff, array $headers = []): TestResponse
    {
        return $this->send('POST', 'login', null, $headers, ['email' => $staff->email, 'password' => self::PASSWORD]);
    }

    private function alive(?string $plainTextToken): bool
    {
        return $plainTextToken !== null && PersonalAccessToken::findToken($plainTextToken) !== null;
    }

    private function otpStub(Staff $staff): string
    {
        Cache::put('user_hash_'.$staff->id, ['secret' => bcrypt('123456')], now()->addMinutes(3));

        return $staff->createToken('token', ['otp'])->plainTextToken;
    }

    public function test_a_web_login_gets_a_single_web_token(): void
    {
        $this->freezeSecond();

        $response = $this->login($this->staff())
            ->assertOk()
            ->assertJsonMissingPath('contacts_token')
            ->assertJsonMissingPath('expires_at');

        $token = PersonalAccessToken::findToken($response->json('token'));

        $this->assertSame('auth_token', $token->name);
        $this->assertTrue($token->expires_at->equalTo(now()->addMinutes(600)));
    }

    public function test_an_app_login_gets_a_session_token_and_a_contacts_token(): void
    {
        $this->freezeSecond();

        $response = $this->login($this->staff(), self::APP)->assertOk();

        $session = PersonalAccessToken::findToken($response->json('token'));
        $contacts = PersonalAccessToken::findToken((string) $response->json('contacts_token'));

        $this->assertSame('staff_app', $session->name);
        $this->assertSame(['*'], $session->abilities);
        $this->assertNotNull($contacts);
        $this->assertSame('staff_app_contacts', $contacts->name);
        $this->assertSame(['address-book'], $contacts->abilities);
        $this->assertTrue($session->expires_at->equalTo(now()->addDays(30)));
        $this->assertTrue($contacts->expires_at->equalTo(now()->addDays(30)));
        $this->assertSame(now()->addDays(30)->toIso8601String(), $response->json('expires_at'));
    }

    public function test_a_web_login_leaves_the_app_session_alone(): void
    {
        $staff = $this->staff();
        $app = $this->login($staff, self::APP)->assertOk();

        $this->login($staff)->assertOk();

        $this->assertTrue($this->alive($app->json('token')));
        $this->assertTrue($this->alive($app->json('contacts_token')));
    }

    public function test_an_app_login_leaves_the_web_session_alone(): void
    {
        $staff = $this->staff();
        $web = $this->login($staff)->assertOk();

        $this->login($staff, self::APP)->assertOk();

        $this->assertTrue($this->alive($web->json('token')));
    }

    public function test_a_second_web_login_ends_the_first_web_session(): void
    {
        $staff = $this->staff();
        $first = $this->login($staff)->assertOk();

        $this->login($staff)->assertOk();

        $this->assertFalse($this->alive($first->json('token')));
    }

    public function test_a_second_app_login_ends_both_earlier_app_tokens(): void
    {
        $staff = $this->staff();
        $first = $this->login($staff, self::APP)->assertOk();
        $this->assertTrue($this->alive($first->json('contacts_token')));

        $second = $this->login($staff, self::APP)->assertOk();

        $this->assertFalse($this->alive($first->json('token')));
        $this->assertFalse($this->alive($first->json('contacts_token')));
        $this->assertTrue($this->alive($second->json('token')));
        $this->assertTrue($this->alive($second->json('contacts_token')));
    }

    public function test_check_otp_issues_app_tokens_and_consumes_its_stub(): void
    {
        $staff = $this->staff(['mfa_default' => 'email']);
        $stub = $this->otpStub($staff);

        $response = $this->send('POST', 'check-otp', $stub, self::APP, ['otp' => '123456'])
            ->assertOk()
            ->assertJsonPath('verified', true);

        $this->assertSame('staff_app', PersonalAccessToken::findToken($response->json('token'))->name);
        $this->assertTrue($this->alive($response->json('contacts_token')));
        $this->assertFalse($this->alive($stub));
    }

    public function test_check_otp_without_the_header_issues_a_web_token(): void
    {
        $staff = $this->staff(['mfa_default' => 'email']);

        $response = $this->send('POST', 'check-otp', $this->otpStub($staff), [], ['otp' => '123456'])
            ->assertOk()
            ->assertJsonMissingPath('contacts_token');

        $this->assertSame('auth_token', PersonalAccessToken::findToken($response->json('token'))->name);
    }

    public function test_a_wrong_code_issues_nothing_and_keeps_the_stub(): void
    {
        $staff = $this->staff(['mfa_default' => 'email']);
        $stub = $this->otpStub($staff);

        $this->send('POST', 'check-otp', $stub, self::APP, ['otp' => '654321'])
            ->assertOk()
            ->assertExactJson(['verified' => false]);

        $this->assertTrue($this->alive($stub));
        $this->assertSame(1, $staff->tokens()->count());
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `DB_DATABASE=accelit_database php artisan test --filter=AppSessionTokensTest`

Expected failures:
- `test_an_app_login_gets_a_session_token_and_a_contacts_token`: the name is `auth_token`, and there is no `contacts_token`.
- `test_a_web_login_leaves_the_app_session_alone`
- `test_an_app_login_leaves_the_web_session_alone`
- `test_a_second_app_login_ends_both_earlier_app_tokens`: the first `contacts_token` is null.
- `test_check_otp_issues_app_tokens_and_consumes_its_stub`

The rest pass already.

- [ ] **Step 3: Add `issueSessionTokens()`**

In `app/Helpers/AuthHelper.php`, add `use Illuminate\Http\Request;` to the imports. Then add these inside the class, above `revokeOtherSessions()`:

```php
    public const STAFF_APP_CLIENT = 'staff-app';

    public const WEB_TOKEN = 'auth_token';

    public const APP_TOKEN = 'staff_app';

    public const APP_CONTACTS_TOKEN = 'staff_app_contacts';

    /**
     * Mint the tokens for a fully authenticated staff sign-in (credentials plus
     * MFA when enabled) and revoke the user's earlier tokens of the same kind.
     *
     * Web and staff-app sessions are separate kinds, so signing in on one never
     * ends the other. Within a kind there is still one session per user, for
     * the MS Edge reason given on revokeOtherSessions(). The staff app also gets
     * an address-book-only token for its background contact sync, which runs
     * without the biometric check that guards the main token on the phone.
     *
     * @return array{token: string, contacts_token?: string, expires_at?: string}
     */
    public static function issueSessionTokens(Staff $user, Request $request): array
    {
        if ($request->header('X-Accel-Client') !== self::STAFF_APP_CLIENT) {
            $user->tokens()->where('name', self::WEB_TOKEN)->delete();

            return ['token' => $user->createToken(self::WEB_TOKEN)->plainTextToken];
        }

        $user->tokens()->whereIn('name', [self::APP_TOKEN, self::APP_CONTACTS_TOKEN])->delete();

        $expiresAt = now()->addDays(config('sanctum.staff_app_token_days'));

        return [
            'token' => $user->createToken(self::APP_TOKEN, ['*'], $expiresAt)->plainTextToken,
            'contacts_token' => $user->createToken(self::APP_CONTACTS_TOKEN, ['address-book'], $expiresAt)->plainTextToken,
            'expires_at' => $expiresAt->toIso8601String(),
        ];
    }
```

Leave `revokeOtherSessions()` in place: `Client\AuthController` still uses it.

- [ ] **Step 4: Use it in `login()`**

In `app/Http/Controllers/AuthController.php`, replace the trusted-device branch:

```php
            if ($isTrusted) {
                // Device is trusted, skip MFA
                AuthHelper::revokeOtherSessions($user);
                $token = $user->createToken('auth_token')->plainTextToken;

                return response()->json([
                    'token' => $token,
                    'user' => fractal($user, new BasicUserTransformer)->toArray()['data'],
                ]);
            }
```

with:

```php
            if ($isTrusted) {
                // Device is trusted, skip MFA
                return response()->json([
                    ...AuthHelper::issueSessionTokens($user, $request),
                    'user' => fractal($user, new BasicUserTransformer)->toArray()['data'],
                ]);
            }
```

and replace the no-MFA `else` branch:

```php
            } else {
                AuthHelper::revokeOtherSessions($user);
                $token = $user->createToken('auth_token')->plainTextToken;

                return response()->json([
                    'token' => $token,
                    'user' => fractal($user, new BasicUserTransformer)->toArray()['data'],
                ]);
            }
```

with:

```php
            } else {
                return response()->json([
                    ...AuthHelper::issueSessionTokens($user, $request),
                    'user' => fractal($user, new BasicUserTransformer)->toArray()['data'],
                ]);
            }
```

- [ ] **Step 5: Use it in `checkOTP()`**

Replace the body of `checkOTP()` from `$user = auth()->user();` down to the closing brace of `if ($verified) { ... }`, leaving the final `return response()->json(['verified' => false]);`. The new text:

```php
        $user = auth()->user();

        if ($user->mfa_default === 'sms' || $user->mfa_default === 'email') {
            $data = Cache::get('user_hash_'.auth()->user()->id);

            $verified = $data && Hash::check($validated['otp'], $data['secret']);
        } else {
            $verified = $this->totp->verifyTOTPCode($user->mfa_totp_secret, $validated['otp']);
        }

        if ($verified) {
            // The OTP stub has done its one job. revokeOtherSessions() used to
            // take it along with every other token; per-kind revocation doesn't.
            $user->currentAccessToken()->delete();

            $tokens = AuthHelper::issueSessionTokens($user, $request);

            // Handle "Remember this device" functionality
            if (isset($validated['remember_device']) && $validated['remember_device']) {
                $deviceToken = MFAHelper::createTrustedDevice($user->id, $request);

                return response()->json([
                    'verified' => true,
                    ...$tokens,
                    'user' => fractal($user, new BasicUserTransformer)->toArray()['data'],
                    'device_token' => $deviceToken,
                ]);
            }

            return response()->json([
                'verified' => true,
                ...$tokens,
                'user' => fractal($user, new BasicUserTransformer)->toArray()['data'],
            ]);
        }
```

- [ ] **Step 6: Run the tests**

Run: `DB_DATABASE=accelit_database php artisan test --filter='AppSessionTokensTest|TokenExpiryTest'`
Expected: all passed (9 + 5).

Run: `grep -n "revokeOtherSessions\|createToken('auth_token')" app/Http/Controllers/AuthController.php`
Expected: no output.

- [ ] **Step 7: Format and commit**

```bash
./vendor/bin/pint --dirty
git add app/Helpers/AuthHelper.php app/Http/Controllers/AuthController.php tests/Feature/AppSessionTokensTest.php
git commit -m "feat: separate staff app sessions from web sessions" -m "Every login revoked every token the staff member had, so signing in on
the phone ended the web session and the reverse. The staff app now
names itself with X-Accel-Client and gets its own token kinds, and a
login only revokes tokens of its own kind. The web keeps its single
session rule."
```

---

### Task 3: The contacts token reads the address book and nothing else; app sign-out takes both

**Files:**
- Modify: `routes/app/api.php`:
  - the admin-group `Broadcast::routes(...)` (~line 179);
  - the `token.can:*` group opening (~line 181);
  - `// Address Book` in that group (~line 200);
  - the host-less `Broadcast::routes(...)` at the end of the file (~line 1063).
- Modify: `app/Http/Controllers/AuthController.php` (`logout()`)
- Test: `tests/Feature/AppSessionTokensTest.php` (append)

**Interfaces:**
- Consumes (Task 2): `AuthHelper::APP_TOKEN`, `AuthHelper::APP_CONTACTS_TOKEN`, and the app login response's `contacts_token`.
- Produces:
  - `GET /api/address-book` accepts any token with the `address-book` ability; `*` includes it.
  - Every other admin route rejects the contacts token with 403 `{"message": "Unauthorized action."}`.
  - `POST /api/logout` with a `staff_app` token deletes the user's `staff_app_contacts` tokens too.

- [ ] **Step 1: Write the failing tests**

Append these methods inside `AppSessionTokensTest`:

```php
    public function test_the_contacts_token_reads_the_address_book_and_nothing_else(): void
    {
        $contacts = $this->login($this->staff(), self::APP)->assertOk()->json('contacts_token');

        $this->send('GET', 'address-book', $contacts)->assertOk();
        $this->send('GET', 'me', $contacts)->assertForbidden();
        $this->send('POST', 'broadcasting/auth', $contacts, [], [
            'socket_id' => '1234.5678',
            'channel_name' => 'private-App.Models.Staff.1',
        ])->assertForbidden()->assertJsonPath('message', 'Unauthorized action.');
    }

    public function test_a_full_token_still_reads_the_address_book(): void
    {
        $web = $this->login($this->staff())->assertOk()->json('token');

        $this->send('GET', 'address-book', $web)->assertOk();
    }

    public function test_an_app_sign_out_ends_both_app_tokens_and_nothing_else(): void
    {
        $staff = $this->staff();
        $web = $this->login($staff)->assertOk()->json('token');
        $app = $this->login($staff, self::APP)->assertOk();

        $this->send('POST', 'logout', $app->json('token'))->assertOk();

        $this->assertFalse($this->alive($app->json('token')));
        $this->assertFalse($this->alive($app->json('contacts_token')));
        $this->assertTrue($this->alive($web));
    }

    public function test_a_web_sign_out_ends_only_the_web_token(): void
    {
        $staff = $this->staff();
        $app = $this->login($staff, self::APP)->assertOk();
        $web = $this->login($staff)->assertOk()->json('token');

        $this->send('POST', 'logout', $web)->assertOk();

        $this->assertFalse($this->alive($web));
        $this->assertTrue($this->alive($app->json('token')));
        $this->assertTrue($this->alive($app->json('contacts_token')));
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `DB_DATABASE=accelit_database php artisan test --filter=AppSessionTokensTest`

Expected failures:
- `test_the_contacts_token_reads_the_address_book_and_nothing_else`: `/address-book` answers 403 to the contacts token.
- `test_an_app_sign_out_ends_both_app_tokens_and_nothing_else`: the contacts token survives.

- [ ] **Step 3: Move the address-book route and guard broadcasting**

In `routes/app/api.php`:

1. Change the admin-group line `    Broadcast::routes(['middleware' => ['auth:sanctum']]);` to:

```php
    Broadcast::routes(['middleware' => ['auth:sanctum', 'token.can:*']]);
```

2. Directly above `    Route::middleware(['auth:sanctum', 'token.can:*'])->group(function () {`, insert:

```php
    // Outside the token.can:* group: the staff app's background contact sync
    // holds a token that can call this and nothing else.
    Route::get('/address-book', [AddressBookController::class, 'index'])->middleware(['auth:sanctum', 'token.can:address-book']);

```

3. Inside that group, delete these two lines together with the blank line after them:

```php
        // Address Book
        Route::get('/address-book', [AddressBookController::class, 'index']);
```

4. Change the last line of the file, `Broadcast::routes(['middleware' => ['auth:sanctum']]);`, to:

```php
// token.can:* keeps ability-limited tokens (the staff app's contacts token,
// OTP stubs) out of private channels; full and stateful tokens pass.
Broadcast::routes(['middleware' => ['auth:sanctum', 'token.can:*']]);
```

- [ ] **Step 4: Take the contacts token on app sign-out**

Replace `logout()` in `AuthController` with:

```php
    public function logout(): JsonResponse
    {
        $user = auth()->user();
        $token = $user->currentAccessToken();

        // The staff app's contact-sync token belongs to its session.
        if ($token->name === AuthHelper::APP_TOKEN) {
            $user->tokens()->where('name', AuthHelper::APP_CONTACTS_TOKEN)->delete();
        }

        $token->delete();

        return response()->json([
            'message' => 'Successfully logged out',
        ]);
    }
```

- [ ] **Step 5: Run the tests and the route check**

Run: `DB_DATABASE=accelit_database php artisan test --filter='AppSessionTokensTest|TokenExpiryTest|UnauthenticatedApiResponseTest'`
Expected: all passed (13 + 5 + 2).

Run: `php artisan route:list --path=address-book -v | grep -E "GET.*api/address-book "`
Expected: exactly one `api/address-book` route, with `auth:sanctum` and `token.can:address-book` in its middleware.

- [ ] **Step 6: Format and commit**

```bash
./vendor/bin/pint --dirty
git add routes/app/api.php app/Http/Controllers/AuthController.php tests/Feature/AppSessionTokensTest.php
git commit -m "feat: scope the staff app contacts token to the address book" -m "The phone's contact sync runs without a biometric check, so it gets a
token that can only read the address book. Broadcasting auth was the
one admin route that took any token regardless of ability; it now
checks too. Signing out of the app takes the contacts token with it."
```

---

## Part B — App (`accelit-staffapp`)

All commands run from `/Users/anelkujovic/Documents/Projects/accelit-staffapp` on `feat/app-sign-in-biometric-unlock`. Baseline before Task 4: `npm test` gives 23 files and 149 tests passed.

### Task 4: Pure session rules

**Files:**
- Create: `app/utils/sessionRules.js`
- Test: `tests/sessionRules.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `LOCK_AFTER_MS: number` (300000).
  - `shouldLock(backgroundedAt: number|null, now: number): boolean`
  - `isExpired(marker: {expiresAt?: string|null}|null, now: number): boolean`
  - `routeFor({ status: 'unlocked'|'locked'|'expired'|'none', inAuthGroup: boolean }): string|null`
  - `classifyUnlockFailure(error: Error|undefined): 'cancelled'|'failed'`
  - `unlockLabel(os: string, types: number[]): string`, one of `'Face ID'`, `'Touch ID'`, `'fingerprint'`, `'face unlock'`, `'biometrics'`.
  - `reasonMessage(reason: string|undefined, label: string): string|null`

- [ ] **Step 1: Write the failing test**

Create `tests/sessionRules.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
    LOCK_AFTER_MS, shouldLock, isExpired, routeFor, classifyUnlockFailure, unlockLabel, reasonMessage,
} from '../app/utils/sessionRules';

describe('shouldLock', () => {
    it('does not lock an app that never went to the background', () => {
        expect(shouldLock(null, 10 * LOCK_AFTER_MS)).toBe(false);
    });

    it('does not lock after a quick switch away', () => {
        expect(shouldLock(1000, 1000 + LOCK_AFTER_MS - 1)).toBe(false);
    });

    it('locks after five minutes away', () => {
        expect(LOCK_AFTER_MS).toBe(5 * 60 * 1000);
        expect(shouldLock(1000, 1000 + LOCK_AFTER_MS)).toBe(true);
    });
});

describe('isExpired', () => {
    const now = Date.parse('2026-10-01T00:00:00Z');

    it('is expired once expiresAt has passed', () => {
        expect(isExpired({ expiresAt: '2026-09-30T23:59:59+00:00' }, now)).toBe(true);
    });

    it('is live before expiresAt', () => {
        expect(isExpired({ expiresAt: '2026-10-30T00:00:00+00:00' }, now)).toBe(false);
    });

    // An older backend sends no expiry. The server's 401 still ends the
    // session; guessing "expired" here would throw a live one away.
    it('treats a missing or unreadable expiry as live', () => {
        expect(isExpired({ expiresAt: null }, now)).toBe(false);
        expect(isExpired({}, now)).toBe(false);
        expect(isExpired(null, now)).toBe(false);
        expect(isExpired({ expiresAt: 'soon' }, now)).toBe(false);
    });
});

describe('routeFor', () => {
    it('leaves an unlocked session where it is', () => {
        expect(routeFor({ status: 'unlocked', inAuthGroup: false })).toBeNull();
    });

    it('sends a locked session to the unlock screen', () => {
        expect(routeFor({ status: 'locked', inAuthGroup: false })).toBe('/(auth)/unlock');
    });

    // "Sign in with password" takes a locked session to the login screen on
    // purpose, and backing out of the code step lands there too.
    it('leaves a locked session on an auth screen', () => {
        expect(routeFor({ status: 'locked', inAuthGroup: true })).toBeNull();
    });

    it('sends an expired session to sign-in and says why', () => {
        expect(routeFor({ status: 'expired', inAuthGroup: false })).toBe('/(auth)/login?reason=expired');
    });

    it('sends no session to sign-in', () => {
        expect(routeFor({ status: 'none', inAuthGroup: false })).toBe('/(auth)/login');
        expect(routeFor({ status: 'none', inAuthGroup: true })).toBeNull();
    });
});

describe('classifyUnlockFailure', () => {
    it('reads the Android cancel', () => {
        const error = new Error('Could not Authenticate the user: User canceled the authentication. Cancel');

        expect(classifyUnlockFailure(error)).toBe('cancelled');
    });

    it('reads the iOS cancel', () => {
        expect(classifyUnlockFailure(new Error('User canceled the operation.'))).toBe('cancelled');
    });

    it('treats anything else as a failure', () => {
        expect(classifyUnlockFailure(new Error('Could not Authenticate the user: Lockout. Too many attempts'))).toBe('failed');
        expect(classifyUnlockFailure(undefined)).toBe('failed');
    });
});

describe('unlockLabel', () => {
    // expo-local-authentication: FINGERPRINT = 1, FACIAL_RECOGNITION = 2.
    it('names what an iPhone has', () => {
        expect(unlockLabel('ios', [2])).toBe('Face ID');
        expect(unlockLabel('ios', [1])).toBe('Touch ID');
    });

    it('prefers the fingerprint on Android, where most face unlock is too weak for the keystore', () => {
        expect(unlockLabel('android', [1, 2])).toBe('fingerprint');
        expect(unlockLabel('android', [2])).toBe('face unlock');
    });

    it('falls back to a generic name', () => {
        expect(unlockLabel('android', [])).toBe('biometrics');
        expect(unlockLabel('ios', [])).toBe('biometrics');
    });
});

describe('reasonMessage', () => {
    it('explains an expired session', () => {
        expect(reasonMessage('expired', 'Face ID')).toBe('Your session expired — sign in again.');
    });

    it('explains changed biometrics by name', () => {
        expect(reasonMessage('changed', 'Face ID')).toBe('Face ID changed on this phone — sign in with your password.');
        expect(reasonMessage('changed', 'fingerprint')).toBe('Fingerprint changed on this phone — sign in with your password.');
    });

    it('says nothing without a reason', () => {
        expect(reasonMessage(undefined, 'Face ID')).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/sessionRules.test.js`
Expected: FAIL, "Failed to resolve import ../app/utils/sessionRules".

- [ ] **Step 3: Write the rules**

Create `app/utils/sessionRules.js`:

```js
// Pure rules for the biometric session. No React and no native modules, so
// every decision about locking and routing can be tested in node.

export const LOCK_AFTER_MS = 5 * 60 * 1000;

// expo-local-authentication's AuthenticationType values.
const FINGERPRINT = 1;
const FACIAL_RECOGNITION = 2;

// `backgroundedAt` is only ever set on AppState 'background', never on
// 'inactive': iOS goes inactive for the Face ID sheet itself, and counting
// that would lock the app in the middle of unlocking it.
export function shouldLock(backgroundedAt, now) {
    return backgroundedAt != null && now - backgroundedAt >= LOCK_AFTER_MS;
}

// A marker without a readable expiry counts as live. The server's 401 ends a
// session it has already expired, so erring this way costs one biometric
// prompt; erring the other way would throw a live session away.
export function isExpired(marker, now) {
    const at = Date.parse(marker?.expiresAt ?? '');

    return Number.isFinite(at) && at <= now;
}

// Where the root layout sends someone, or null to leave them where they are.
// Auth screens are always left alone: "Sign in with password" takes a locked
// session to the login screen on purpose, and the code step runs with no
// session at all.
export function routeFor({ status, inAuthGroup }) {
    if (status === 'unlocked' || inAuthGroup) return null;
    if (status === 'locked') return '/(auth)/unlock';
    if (status === 'expired') return '/(auth)/login?reason=expired';

    return '/(auth)/login';
}

// A biometric-bound SecureStore read that throws either was cancelled —
// Android says "User canceled the authentication", iOS "User canceled the
// operation." — or failed for another reason (lockout, hardware). The third
// outcome, null for an item the OS invalidated, is the caller's to handle.
export function classifyUnlockFailure(error) {
    return /cancel/i.test(error?.message ?? '') ? 'cancelled' : 'failed';
}

export function unlockLabel(os, types = []) {
    const face = types.includes(FACIAL_RECOGNITION);
    const finger = types.includes(FINGERPRINT);

    if (os === 'ios') {
        if (face) return 'Face ID';
        if (finger) return 'Touch ID';

        return 'biometrics';
    }

    if (finger) return 'fingerprint';
    if (face) return 'face unlock';

    return 'biometrics';
}

export function reasonMessage(reason, label) {
    if (reason === 'expired') return 'Your session expired — sign in again.';

    if (reason === 'changed') {
        const name = label.charAt(0).toUpperCase() + label.slice(1);

        return `${name} changed on this phone — sign in with your password.`;
    }

    return null;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/sessionRules.test.js`
Expected: PASS.

Run: `npm test`
Expected: 24 files passed.

- [ ] **Step 5: Commit**

```bash
git add app/utils/sessionRules.js tests/sessionRules.test.js
git commit -F - <<'EOF'
feat: pure rules for locking, routing and unlock outcomes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: The session service

**Files:**
- Modify: `package.json`, `package-lock.json` (through `npx expo install`)
- Modify: `app.json`
- Modify: `app/constants/storageKeys.js`
- Create: `app/services/session.js`
- Test: `tests/session.test.js`

**Interfaces:**
- Consumes:
  - Task 4: `isExpired`, `classifyUnlockFailure`, `unlockLabel`.
  - `onSessionEnded({ explicit })` from `app/utils/contactSync.js`.
- Produces (`import * as session from '../services/session'`):
  - `currentToken(): string|null`
  - `biometricsUsable(): boolean`
  - `start(response: {token, expires_at?}, email: string): Promise<boolean>`, which resolves `true` when the session will survive the app closing.
  - `unlock(): Promise<'unlocked'|'changed'|'cancelled'|'failed'>`
  - `lock(): void`
  - `end(): Promise<void>`
  - `status(now?: number): Promise<'unlocked'|'locked'|'expired'|'none'>`
  - `lastEmail(): Promise<string>`
  - `label(): Promise<string>`
- Storage keys:
  - adds `STORAGE_KEYS.sessionMarker`, `.lastEmail`, `.webToken`, `.legacyToken`;
  - adds `SECURE_SESSION_KEY`.
  - `STORAGE_KEYS.token` stays for now. `api.js` still uses it until Task 7.

- [ ] **Step 1: Install the native modules and configure them**

Run: `npx expo install expo-secure-store expo-local-authentication`
Expected: `package.json` gains `"expo-secure-store": "~15.0.8"` and `"expo-local-authentication": "~17.0.9"`.

In `app.json`:
- Change `"version": "1.0.0"` to `"version": "1.1.0"`.
- Change `"runtimeVersion": "1.0.0"` to `"runtimeVersion": "1.1.0"`.
- Replace the `"plugins"` array with:

```json
    "plugins": [
      "expo-router",
      "expo-font",
      "./modules/accel-contacts/app.plugin.js",
      [
        "expo-secure-store",
        {
          "faceIDPermission": "Accel Staff uses Face ID to unlock your session.",
          "configureAndroidBackup": false
        }
      ],
      [
        "expo-local-authentication",
        {
          "faceIDPermission": "Accel Staff uses Face ID to unlock your session."
        }
      ]
    ],
```

`configureAndroidBackup: false`: backup is already off (`allowBackup=false`), and the accel-contacts plugin owns `dataExtractionRules`. Secure-store's own rules would only conflict.

Run: `npx expo config --type public | grep -E "runtimeVersion|version:"`
Expected: `version: '1.1.0'` and `runtimeVersion: '1.1.0'`. The command also fails loudly if either plugin cannot be resolved. The Face ID usage text only shows up in a native build, so it is checked on the device (checklist row 1, the iOS permission prompt).

- [ ] **Step 2: Add the storage keys**

Replace `app/constants/storageKeys.js` with:

```js
export const STORAGE_KEYS = {
    // Pre-1.1.0 home of the full token. Task 7 removes this alias; until then
    // api.js still reads it.
    token: 'authToken',
    // 64-char device token from check-otp's remember_device. Suppresses MFA for
    // three weeks. Sent back as the X-MFA-Device-Token header.
    mfaDeviceToken: 'mfaDeviceToken',
    // {expiresAt} for the stored session. Says a biometric-locked session
    // exists without reading it, because reading it is what raises the Face ID
    // or fingerprint prompt. Holds nothing secret.
    sessionMarker: 'sessionMarker',
    // The email of the last successful full sign-in, to prefill the login form.
    // Survives sign-out: remembering the username is the point.
    lastEmail: 'lastEmail',
    // Web only (the Chrome dev harness): the session token. The web has no
    // secure store and no biometrics, so it keeps the pre-1.1.0 behaviour.
    webToken: 'webSessionToken',
    // Before 1.1.0 the full token sat here in plain AsyncStorage. Read only to
    // delete it (session.js).
    legacyToken: 'authToken',
    themeMode: 'themeMode',
};

// SecureStore key for the staff_app token (session.js). Written with
// requireAuthentication, so only a biometric match reads it back.
export const SECURE_SESSION_KEY = 'staffAppSession';

// Everything cleared on logout and on any 401.
export const ALL_AUTH_KEYS = [STORAGE_KEYS.token, STORAGE_KEYS.mfaDeviceToken];

export default STORAGE_KEYS;
```

- [ ] **Step 3: Write the failing test**

Create `tests/session.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// One place for everything the session touches, so each test can set the
// phone up the way it needs: which OS, what is stored, whether biometrics
// work, and what the OS answers a biometric read or write with.
const env = vi.hoisted(() => {
    const state = {
        os: 'ios',
        async: new Map(),
        secure: new Map(),
        usable: true,
        readError: null,
        readNull: false,
        writeError: null,
        types: [2],
    };

    state.getItemAsync = vi.fn(async (key) => {
        if (state.readError) throw state.readError;
        if (state.readNull) return null;

        return state.secure.get(key) ?? null;
    });
    state.setItemAsync = vi.fn(async (key, value) => {
        if (state.writeError) throw state.writeError;
        state.secure.set(key, value);
    });
    state.deleteItemAsync = vi.fn(async (key) => { state.secure.delete(key); });
    state.onSessionEnded = vi.fn(async () => {});

    return state;
});

vi.mock('react-native', () => ({ Platform: { get OS() { return env.os; } } }));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async (key) => env.async.get(key) ?? null,
        setItem: async (key, value) => { env.async.set(key, value); },
        removeItem: async (key) => { env.async.delete(key); },
        multiRemove: async (keys) => { keys.forEach((key) => env.async.delete(key)); },
    },
}));

vi.mock('expo-secure-store', () => ({
    canUseBiometricAuthentication: () => env.usable,
    getItemAsync: env.getItemAsync,
    setItemAsync: env.setItemAsync,
    deleteItemAsync: env.deleteItemAsync,
}));

vi.mock('expo-local-authentication', () => ({
    supportedAuthenticationTypesAsync: async () => env.types,
}));

vi.mock('../app/utils/contactSync', () => ({ onSessionEnded: env.onSessionEnded }));

const KEY = 'staffAppSession';
const OPTIONS = { requireAuthentication: true, authenticationPrompt: 'Unlock Accel Staff' };
const EXPIRES = '2026-10-30T00:00:00+00:00';
const BEFORE_EXPIRY = Date.parse('2026-10-01T00:00:00Z');
const AFTER_EXPIRY = Date.parse('2026-11-01T00:00:00Z');

const marker = () => JSON.parse(env.async.get('sessionMarker') ?? 'null');

let session;

// The module keeps the token and the upgrade check in module state, so every
// test gets a fresh copy, loaded for the OS it wants.
const load = async (os = 'ios') => {
    env.os = os;
    vi.resetModules();
    session = await import('../app/services/session');
};

const signIn = (token = 'app-token') => session.start({ token, expires_at: EXPIRES }, 'jo@accelit.com.au');

beforeEach(async () => {
    env.async.clear();
    env.secure.clear();
    env.usable = true;
    env.readError = null;
    env.readNull = false;
    env.writeError = null;
    env.types = [2];
    vi.clearAllMocks();
    await load();
});

describe('start', () => {
    it('stores the token behind biometrics and remembers the email', async () => {
        await expect(signIn()).resolves.toBe(true);

        expect(env.setItemAsync).toHaveBeenCalledWith(KEY, 'app-token', OPTIONS);
        expect(marker()).toEqual({ expiresAt: EXPIRES });
        expect(env.async.get('lastEmail')).toBe('jo@accelit.com.au');
        expect(session.currentToken()).toBe('app-token');
    });

    it('keeps the token in memory only when no biometric is enrolled', async () => {
        env.usable = false;

        await expect(signIn()).resolves.toBe(false);

        expect(env.setItemAsync).not.toHaveBeenCalled();
        expect(marker()).toBeNull();
        expect(session.currentToken()).toBe('app-token');
        expect(env.async.get('lastEmail')).toBe('jo@accelit.com.au');
    });

    it('leaves no stored session behind when the write is refused, not even an older one', async () => {
        env.secure.set(KEY, 'old-token');
        env.async.set('sessionMarker', JSON.stringify({ expiresAt: EXPIRES }));
        env.writeError = new Error('Could not Authenticate the user: User canceled the authentication. Cancel');

        await expect(signIn('new-token')).resolves.toBe(false);

        expect(marker()).toBeNull();
        expect(env.secure.has(KEY)).toBe(false);
        expect(session.currentToken()).toBe('new-token');
        expect(await session.status(BEFORE_EXPIRY)).toBe('unlocked');
    });

    it('marks a session whose expiry the server did not send', async () => {
        await session.start({ token: 'app-token' }, 'jo@accelit.com.au');

        expect(marker()).toEqual({ expiresAt: null });
    });
});

describe('unlock', () => {
    beforeEach(async () => {
        await signIn();
        session.lock();
    });

    it('reads the token back after a match', async () => {
        await expect(session.unlock()).resolves.toBe('unlocked');

        expect(env.getItemAsync).toHaveBeenCalledWith(KEY, OPTIONS);
        expect(session.currentToken()).toBe('app-token');
    });

    it('clears the session when the OS has invalidated it', async () => {
        env.readNull = true;

        await expect(session.unlock()).resolves.toBe('changed');

        expect(marker()).toBeNull();
        expect(env.deleteItemAsync).toHaveBeenCalledWith(KEY, OPTIONS);
        expect(session.currentToken()).toBeNull();
    });

    it('keeps the session when the prompt is cancelled', async () => {
        env.readError = new Error('User canceled the operation.');

        await expect(session.unlock()).resolves.toBe('cancelled');

        expect(marker()).toEqual({ expiresAt: EXPIRES });
    });

    it('keeps the session when unlocking fails for another reason', async () => {
        env.readError = new Error('Could not Authenticate the user: Lockout. Too many attempts');

        await expect(session.unlock()).resolves.toBe('failed');

        expect(marker()).toEqual({ expiresAt: EXPIRES });
    });
});

describe('status', () => {
    it('is none with nothing stored', async () => {
        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('none');
    });

    it('is locked with a live stored session and nothing in memory', async () => {
        await signIn();
        session.lock();

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('locked');
    });

    it('is unlocked while the token is in memory', async () => {
        await signIn();

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('unlocked');
    });

    it('reports an expired session once, then forgets it', async () => {
        await signIn();
        session.lock();

        await expect(session.status(AFTER_EXPIRY)).resolves.toBe('expired');
        await expect(session.status(AFTER_EXPIRY)).resolves.toBe('none');
        expect(env.secure.has(KEY)).toBe(false);
    });

    it('clears a stored session that biometrics can no longer open', async () => {
        await signIn();
        session.lock();
        env.usable = false;

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('none');
        expect(marker()).toBeNull();
    });

    it('is none after the session ends, and the email stays', async () => {
        await signIn();
        await session.end();

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('none');
        await expect(session.lastEmail()).resolves.toBe('jo@accelit.com.au');
    });
});

describe('upgrading from 1.0.0', () => {
    it('deletes the old plain token and takes it off the contact worker, once', async () => {
        env.async.set('authToken', 'old-full-token');

        await session.status(BEFORE_EXPIRY);
        await session.status(BEFORE_EXPIRY);

        expect(env.async.has('authToken')).toBe(false);
        expect(env.onSessionEnded).toHaveBeenCalledTimes(1);
        expect(env.onSessionEnded).toHaveBeenCalledWith({ explicit: false });
    });

    it('leaves the contact worker alone when there was nothing to migrate', async () => {
        await session.status(BEFORE_EXPIRY);

        expect(env.onSessionEnded).not.toHaveBeenCalled();
    });
});

describe('on web', () => {
    beforeEach(async () => { await load('web'); });

    it('keeps the token in AsyncStorage with no lock, as before', async () => {
        await expect(signIn()).resolves.toBe(true);

        expect(env.setItemAsync).not.toHaveBeenCalled();
        expect(env.async.get('webSessionToken')).toBe('app-token');
    });

    it('is still signed in after a page reload', async () => {
        await signIn();
        await load('web');

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('unlocked');
        expect(session.currentToken()).toBe('app-token');
    });

    it('signs out', async () => {
        await signIn();
        await session.end();
        await load('web');

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('none');
    });
});

describe('label', () => {
    it('names the biometric the phone has', async () => {
        await expect(session.label()).resolves.toBe('Face ID');
    });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/session.test.js`
Expected: FAIL, "Failed to resolve import ../app/services/session".

- [ ] **Step 5: Write the session service**

Create `app/services/session.js`:

```js
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { STORAGE_KEYS, SECURE_SESSION_KEY } from '../constants/storageKeys';
import { onSessionEnded } from '../utils/contactSync';
import { isExpired, classifyUnlockFailure, unlockLabel } from '../utils/sessionRules';

// The one holder of the staff_app token. While unlocked it sits in memory
// here. At rest on a phone it sits in the Keychain / Keystore with
// requireAuthentication, so the OS hands it back only after a Face ID or
// fingerprint match: the biometric check is the OS's, not ours. A phone with
// no biometric enrolled never stores it, and signs in with the password.
//
// The same options go on every call. On iOS they pick the keychain entry, and
// an entry written with requireAuthentication is not found by a call without.
const SECURE_OPTIONS = { requireAuthentication: true, authenticationPrompt: 'Unlock Accel Staff' };

const isWeb = Platform.OS === 'web';

let token = null;
let migration = null;

export const currentToken = () => token;

// Android: BIOMETRIC_STRONG enrolled. iOS: biometrics enrolled and the Face ID
// permission not refused. Exactly what a biometric-bound write needs.
export function biometricsUsable() {
    if (isWeb) return false;

    try {
        return SecureStore.canUseBiometricAuthentication();
    } catch (error) {
        console.warn('session: biometric check failed', error);

        return false;
    }
}

async function clearStored() {
    await AsyncStorage.multiRemove([STORAGE_KEYS.sessionMarker, STORAGE_KEYS.webToken]);

    if (isWeb) return;

    try {
        await SecureStore.deleteItemAsync(SECURE_SESSION_KEY, SECURE_OPTIONS);
    } catch (error) {
        console.warn('session: could not delete the stored token', error);
    }
}

// A full sign-in. Resolves true when the session will survive the app closing.
export async function start({ token: fresh, expires_at: expiresAt } = {}, email) {
    token = fresh;

    if (email) await AsyncStorage.setItem(STORAGE_KEYS.lastEmail, email);

    if (isWeb) {
        await AsyncStorage.setItem(STORAGE_KEYS.webToken, fresh);

        return true;
    }

    // Whatever is stored belongs to an older session. It goes first, so a
    // write refused below cannot leave a marker pointing at nothing.
    await clearStored();

    if (!biometricsUsable()) return false;

    try {
        // Android asks for a fingerprint to write this; iOS asks only to read.
        await SecureStore.setItemAsync(SECURE_SESSION_KEY, fresh, SECURE_OPTIONS);
    } catch (error) {
        // Cancelled, or the Keystore refused. This run carries on; the next
        // open is a password sign-in.
        console.warn('session: could not store the token', error);

        return false;
    }

    await AsyncStorage.setItem(STORAGE_KEYS.sessionMarker, JSON.stringify({ expiresAt: expiresAt ?? null }));

    return true;
}

// Reading the token back is the biometric prompt.
export async function unlock() {
    let stored;

    try {
        stored = await SecureStore.getItemAsync(SECURE_SESSION_KEY, SECURE_OPTIONS);
    } catch (error) {
        return classifyUnlockFailure(error);
    }

    // SecureStore answers null for an item the OS has invalidated: a face or
    // fingerprint was added or removed since it was written.
    if (!stored) {
        await clearStored();

        return 'changed';
    }

    token = stored;

    return 'unlocked';
}

export function lock() {
    token = null;
}

export async function end() {
    token = null;
    await clearStored();
}

async function readMarker() {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.sessionMarker);

    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

// Builds before 1.1.0 kept the full token in plain AsyncStorage and gave the
// contact worker a copy. Both go, the first time this build asks.
function migrateLegacy() {
    if (!migration) {
        migration = (async () => {
            if (!(await AsyncStorage.getItem(STORAGE_KEYS.legacyToken))) return;

            await AsyncStorage.removeItem(STORAGE_KEYS.legacyToken);
            await onSessionEnded({ explicit: false });
        })();
    }

    return migration;
}

// 'expired' is reported once: the session is cleared as it is reported, so the
// sign-in screen can say why and the next check says 'none'.
export async function status(now = Date.now()) {
    await migrateLegacy();

    if (token) return 'unlocked';

    if (isWeb) {
        token = await AsyncStorage.getItem(STORAGE_KEYS.webToken);

        return token ? 'unlocked' : 'none';
    }

    const marker = await readMarker();

    if (!marker) return 'none';

    if (isExpired(marker, now)) {
        await clearStored();

        return 'expired';
    }

    // Biometrics removed, or the Face ID permission withdrawn: the stored token
    // can never be read again, so don't offer a prompt that cannot succeed.
    if (!biometricsUsable()) {
        await clearStored();

        return 'none';
    }

    return 'locked';
}

export async function lastEmail() {
    return (await AsyncStorage.getItem(STORAGE_KEYS.lastEmail)) || '';
}

export async function label() {
    try {
        return unlockLabel(Platform.OS, await LocalAuthentication.supportedAuthenticationTypesAsync());
    } catch (error) {
        console.warn('session: could not read the biometric types', error);

        return unlockLabel(Platform.OS, []);
    }
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/session.test.js`
Expected: PASS.

Run: `npm test`
Expected: 25 files passed.

Run: `npx expo-doctor`
Expected: no dependency-version complaints about the two new modules.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app.json app/constants/storageKeys.js app/services/session.js tests/session.test.js
git commit -F - <<'EOF'
feat: session service keeps the app token behind biometrics

The token lives in the Keychain / Keystore with requireAuthentication,
so the OS releases it only after a Face ID or fingerprint match. A
phone with no biometric keeps it in memory only. Native modules added,
so the runtime version moves to 1.1.0.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: Unlock screen

**Files:**
- Create: `app/(auth)/unlock.js`
- Test: `tests/unlockScreen.test.js`

**Interfaces:**
- Consumes (Task 5): `session.unlock()`, `session.lastEmail()`, `session.label()`.
- Produces: the route `/(auth)/unlock`. On success it navigates with `router.replace('/(main)')`. On `changed` it uses `router.replace('/(auth)/login?reason=changed')`. "Sign in with password" uses `router.push('/(auth)/login')`.

- [ ] **Step 1: Write the failing test**

Create `tests/unlockScreen.test.js`:

```js
/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    unlock: vi.fn(),
    lastEmail: vi.fn(async () => 'jo@accelit.com.au'),
    label: vi.fn(async () => 'Face ID'),
    replace: vi.fn(),
    push: vi.fn(),
}));

vi.mock('react-native', async () => {
    const R = await import('react');
    const el = (tag, map = () => ({})) => ({ children, ...props }) => R.createElement(tag, map(props), children);

    return {
        View: el('div'),
        Text: el('span'),
        Image: () => R.createElement('img'),
        ActivityIndicator: el('progress'),
        TouchableOpacity: el('button', (p) => ({ onClick: p.onPress, disabled: p.disabled })),
        StyleSheet: { create: (s) => s },
    };
});

vi.mock('react-native-safe-area-context', async () => {
    const R = await import('react');

    return { SafeAreaView: ({ children }) => R.createElement('div', null, children) };
});

vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('expo-router', () => ({ router: { replace: mocks.replace, push: mocks.push } }));
vi.mock('../app/services/session', () => ({
    unlock: mocks.unlock,
    lastEmail: mocks.lastEmail,
    label: mocks.label,
}));

import UnlockScreen from '../app/(auth)/unlock';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const settle = async () => {
    for (let i = 0; i < 3; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    }
};

const mount = async (element = React.createElement(UnlockScreen)) => {
    await act(async () => { root.render(element); });
    await settle();
};

const button = (text) => [...container.querySelectorAll('button')].find((b) => b.textContent === text);

const tap = async (text) => {
    await act(async () => { button(text).click(); });
    await settle();
};

beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
});

describe('UnlockScreen', () => {
    it('asks as it opens and goes into the app on a match', async () => {
        mocks.unlock.mockResolvedValue('unlocked');

        await mount();

        expect(mocks.unlock).toHaveBeenCalledTimes(1);
        expect(mocks.replace).toHaveBeenCalledWith('/(main)');
    });

    // StrictMode runs effects twice. A second read while the first prompt is
    // up is refused on Android, and that refusal would read as a failure.
    it('asks only once even when the effect runs twice', async () => {
        mocks.unlock.mockResolvedValue('cancelled');

        await mount(React.createElement(React.StrictMode, null, React.createElement(UnlockScreen)));

        expect(mocks.unlock).toHaveBeenCalledTimes(1);
    });

    it('shows whose session it is and names the biometric', async () => {
        mocks.unlock.mockResolvedValue('cancelled');

        await mount();

        expect(container.textContent).toContain('jo@accelit.com.au');
        expect(button('Unlock with Face ID')).toBeTruthy();
    });

    it('stays quiet after a cancel and asks again on a tap', async () => {
        mocks.unlock.mockResolvedValue('cancelled');

        await mount();
        expect(container.textContent).not.toContain("Couldn't unlock");

        await tap('Unlock with Face ID');

        expect(mocks.unlock).toHaveBeenCalledTimes(2);
    });

    it('says so when unlocking fails', async () => {
        mocks.unlock.mockResolvedValue('failed');

        await mount();

        expect(container.textContent).toContain("Couldn't unlock. Try again, or sign in with your password.");
    });

    it('sends changed biometrics to the password sign-in', async () => {
        mocks.unlock.mockResolvedValue('changed');

        await mount();

        expect(mocks.replace).toHaveBeenCalledWith('/(auth)/login?reason=changed');
    });

    it('offers the password instead', async () => {
        mocks.unlock.mockResolvedValue('cancelled');

        await mount();
        await tap('Sign in with password');

        expect(mocks.push).toHaveBeenCalledWith('/(auth)/login');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unlockScreen.test.js`
Expected: FAIL, "Failed to resolve import ../app/(auth)/unlock".

- [ ] **Step 3: Write the screen**

Create `app/(auth)/unlock.js`:

```js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as session from '../services/session';
import t from '../constants/authTheme';

const FAILED = "Couldn't unlock. Try again, or sign in with your password.";

export default function UnlockScreen() {
    const [email, setEmail] = useState('');
    const [label, setLabel] = useState('biometrics');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    // One prompt at a time: Android refuses a second read while the first
    // prompt is up, and that refusal would read as a failed unlock.
    const inFlight = useRef(false);
    const prompted = useRef(false);

    const attempt = useCallback(async () => {
        if (inFlight.current) return;

        inFlight.current = true;
        setBusy(true);
        setError(null);

        const result = await session.unlock();

        inFlight.current = false;
        setBusy(false);

        if (result === 'unlocked') {
            router.replace('/(main)');
        } else if (result === 'changed') {
            router.replace('/(auth)/login?reason=changed');
        } else if (result === 'failed') {
            setError(FAILED);
        }
        // 'cancelled': they closed the prompt on purpose. The button stays.
    }, []);

    useEffect(() => {
        (async () => {
            setEmail(await session.lastEmail());
            setLabel(await session.label());
        })();

        // Ask straight away rather than making them tap first. The ref, not the
        // effect, decides: StrictMode runs this effect twice.
        if (!prompted.current) {
            prompted.current = true;
            attempt();
        }
    }, [attempt]);

    return (
        <SafeAreaView style={styles.screen}>
            <StatusBar style="light" />
            <View style={styles.body}>
                <Image
                    source={require('../../assets/icon.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.title}>Accel Staff</Text>
                {email ? <Text style={styles.subtitle}>{email}</Text> : null}

                <TouchableOpacity
                    onPress={attempt}
                    disabled={busy}
                    style={[styles.button, busy && { opacity: 0.6 }]}
                    accessibilityRole="button"
                >
                    {busy
                        ? <ActivityIndicator color={t.onAccent} />
                        : <Text style={styles.buttonText}>{`Unlock with ${label}`}</Text>}
                </TouchableOpacity>

                {error ? (
                    <View style={styles.errorRow}>
                        <Ionicons name="alert-circle-outline" size={16} color={t.error} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <TouchableOpacity onPress={() => router.push('/(auth)/login')} accessibilityRole="button">
                    <Text style={styles.link}>Sign in with password</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    logo: { width: 140, height: 46, alignSelf: 'center', marginBottom: 18 },
    title: { color: t.textPrimary, fontSize: 22, fontWeight: '700', textAlign: 'center' },
    subtitle: { color: t.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4 },
    button: {
        marginTop: 28,
        backgroundColor: t.accent,
        borderRadius: 12, paddingVertical: 14,
        alignItems: 'center',
    },
    buttonText: { color: t.onAccent, fontSize: 15, fontWeight: '700' },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    errorText: { color: t.error, fontSize: 13, flex: 1 },
    link: { color: t.accent, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 22 },
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unlockScreen.test.js`
Expected: PASS (7 tests).

Run: `npm test`
Expected: 26 files passed.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/unlock.js" tests/unlockScreen.test.js
git commit -F - <<'EOF'
feat: unlock screen asks for Face ID or a fingerprint

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: Sign-in, requests and routing go through the session

**Files:**
- Modify: `app/services/api.js` (top of file through `me()`)
- Modify: `app/utils/authFlow.js` (whole file)
- Modify: `app/constants/storageKeys.js` (drop the `token` alias)
- Modify: `app/utils/contactSync.js:17-19` (comment)
- Modify: `app/(auth)/login.js:31,66`
- Modify: `app/(auth)/otp.js:11,57,91-94`
- Modify: `app/_layout.js` (`useProtectedRoute`, imports)
- Modify: `app/index.js`
- Test: `tests/api.test.js` (rewrite), `tests/authFlow.test.js` (create), `tests/rootLayout.test.js` (update)

**Interfaces:**
- Consumes:
  - Task 5: `session.currentToken()`, `session.start(response, email)`, `session.end()`, `session.status()`.
  - Task 4: `routeFor()`.
  - Tasks 2–3 backend: the response fields `token`, `contacts_token`, `expires_at`, `otpToken`, `device_token`.
- Produces:
  - `api.js`:
    - `CLIENT_HEADER` (`{ 'X-Accel-Client': 'staff-app' }`), sent on every request;
    - `api.setOtpToken(token)`, `api.otpToken`;
    - `api.setDeviceToken(token)`;
    - `api.loadDeviceToken(): Promise<void>`.
  - `api.restore()` and `api.setToken()` are gone.
  - `authFlow.js`:
    - `completeSignIn(response, email)`;
    - `abandonOtp()`;
    - `clearAuth()`;
    - `routePostAuth(response, email)`.
  - `persistAuth` is gone.
  - The OTP route receives an `email` param.

- [ ] **Step 1: Write the failing tests**

Replace `tests/api.test.js` with:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const store = vi.hoisted(() => ({ data: new Map() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async (key) => store.data.get(key) ?? null,
        setItem: async (key, value) => { store.data.set(key, value); },
        removeItem: async (key) => { store.data.delete(key); },
        multiRemove: async (keys) => { keys.forEach((key) => store.data.delete(key)); },
    },
}));

vi.mock('expo-router', () => ({ router: { replace: vi.fn(), push: vi.fn() } }));

const sync = vi.hoisted(() => ({ onSessionStarted: vi.fn(async () => {}), onSessionEnded: vi.fn(async () => {}) }));

vi.mock('../app/utils/contactSync', () => sync);

const session = vi.hoisted(() => ({ token: null, currentToken: vi.fn(), end: vi.fn(async () => {}) }));

vi.mock('../app/services/session', () => ({ currentToken: session.currentToken, end: session.end }));

import { router } from 'expo-router';
import api from '../app/services/api';
import { STORAGE_KEYS } from '../app/constants/storageKeys';

const reply = (status, body) => vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
}));

const sentHeaders = () => fetch.mock.calls[0][1].headers;

beforeEach(() => {
    vi.clearAllMocks();
    store.data.clear();
    api.setOtpToken(null);
    api.setDeviceToken(null);
    session.token = null;
    session.currentToken.mockImplementation(() => session.token);
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('what a request carries', () => {
    it('names the staff app, so sign-in mints app tokens', async () => {
        vi.stubGlobal('fetch', reply(200, { allowed: true }));

        await api.ipCheck();

        expect(sentHeaders()['X-Accel-Client']).toBe('staff-app');
    });

    it('sends the session token', async () => {
        session.token = 'app-token';
        vi.stubGlobal('fetch', reply(200, {}));

        await api.me();

        expect(sentHeaders().Authorization).toBe('Bearer app-token');
    });

    it('sends the OTP stub during the code step', async () => {
        api.setOtpToken('otp-stub');
        vi.stubGlobal('fetch', reply(200, { verified: false }));

        await api.checkOtp('123456', true);

        expect(sentHeaders().Authorization).toBe('Bearer otp-stub');
    });

    it('sends no token with the password itself', async () => {
        session.token = 'app-token';
        vi.stubGlobal('fetch', reply(200, {}));

        await api.login('jo@accelit.com.au', 'secret-pass');

        expect(sentHeaders().Authorization).toBeUndefined();
    });

    it('sends the remembered device with the password', async () => {
        store.data.set(STORAGE_KEYS.mfaDeviceToken, 'device-token');
        vi.stubGlobal('fetch', reply(200, {}));

        await api.loadDeviceToken();
        await api.login('jo@accelit.com.au', 'secret-pass');

        expect(sentHeaders()['X-MFA-Device-Token']).toBe('device-token');
    });
});

// A 401 means "that token is dead" only when a token was sent. The login
// route answers a wrong password with 401 too; bouncing to the login screen
// on that remounts the form and loses the error before it is shown.
describe('401 handling', () => {
    it('surfaces a wrong password as an error instead of restarting the login screen', async () => {
        vi.stubGlobal('fetch', reply(401, { errors: { credentials: ['Invalid Username or Password.'] } }));

        await expect(api.login('jo@accelit.com.au', 'nope')).rejects.toMatchObject({
            status: 401,
            message: 'Invalid Username or Password.',
        });
        expect(router.replace).not.toHaveBeenCalled();
        expect(session.end).not.toHaveBeenCalled();
    });

    it('ends a dead session, stored copy included, and says why', async () => {
        session.token = 'dead-token';
        store.data.set(STORAGE_KEYS.mfaDeviceToken, 'device-token');
        vi.stubGlobal('fetch', reply(401, { message: 'Unauthenticated.' }));

        await expect(api.me()).rejects.toMatchObject({ status: 401 });

        expect(session.end).toHaveBeenCalledTimes(1);
        expect(sync.onSessionEnded).toHaveBeenCalledWith({ explicit: false });
        expect(router.replace).toHaveBeenCalledWith('/(auth)/login?reason=expired');
        expect(store.data.has(STORAGE_KEYS.mfaDeviceToken)).toBe(false);
    });

    it('drops a dead OTP stub without touching a locked session', async () => {
        api.setOtpToken('otp-stub');
        vi.stubGlobal('fetch', reply(401, { message: 'Unauthenticated.' }));

        await expect(api.checkOtp('123456', false)).rejects.toMatchObject({ status: 401 });

        expect(session.end).not.toHaveBeenCalled();
        expect(api.otpToken).toBeNull();
        expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
    });
});
```

Create `tests/authFlow.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({ data: new Map() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async (key) => store.data.get(key) ?? null,
        setItem: async (key, value) => { store.data.set(key, value); },
        removeItem: async (key) => { store.data.delete(key); },
        multiRemove: async (keys) => { keys.forEach((key) => store.data.delete(key)); },
    },
}));

vi.mock('expo-router', () => ({ router: { replace: vi.fn(), push: vi.fn() } }));

const sync = vi.hoisted(() => ({ onSessionStarted: vi.fn(async () => {}), onSessionEnded: vi.fn(async () => {}) }));

vi.mock('../app/utils/contactSync', () => sync);

const session = vi.hoisted(() => ({
    start: vi.fn(async () => true),
    end: vi.fn(async () => {}),
    currentToken: vi.fn(() => null),
}));

vi.mock('../app/services/session', () => session);

import { router } from 'expo-router';
import api, { API_BASE_URL } from '../app/services/api';
import { completeSignIn, abandonOtp, clearAuth, routePostAuth } from '../app/utils/authFlow';
import { STORAGE_KEYS } from '../app/constants/storageKeys';

const FULL = {
    token: 'app-token',
    contacts_token: 'contacts-token',
    expires_at: '2026-10-30T00:00:00+00:00',
};

beforeEach(() => {
    vi.clearAllMocks();
    store.data.clear();
    api.setOtpToken(null);
    api.setDeviceToken(null);
});

describe('completeSignIn', () => {
    it('starts the session with the email and drops the stub', async () => {
        api.setOtpToken('otp-stub');

        await completeSignIn(FULL, 'jo@accelit.com.au');

        expect(session.start).toHaveBeenCalledWith(FULL, 'jo@accelit.com.au');
        expect(api.otpToken).toBeNull();
    });

    it('gives contact sync the address-book token and never the full one', async () => {
        await completeSignIn(FULL, 'jo@accelit.com.au');

        expect(sync.onSessionStarted).toHaveBeenCalledWith('contacts-token', API_BASE_URL);
        expect(sync.onSessionStarted.mock.calls.flat()).not.toContain('app-token');
    });

    it('gives contact sync nothing when an older backend sends no contacts token', async () => {
        await completeSignIn({ token: 'app-token' }, 'jo@accelit.com.au');

        expect(sync.onSessionStarted).not.toHaveBeenCalled();
    });

    it('remembers the device when the server hands one back', async () => {
        await completeSignIn({ ...FULL, device_token: 'device-token' }, 'jo@accelit.com.au');

        expect(store.data.get(STORAGE_KEYS.mfaDeviceToken)).toBe('device-token');
        expect(api.deviceToken).toBe('device-token');
    });
});

describe('routePostAuth', () => {
    it('signs straight in on a full token', async () => {
        await routePostAuth(FULL, 'jo@accelit.com.au');

        expect(session.start).toHaveBeenCalledWith(FULL, 'jo@accelit.com.au');
        expect(router.replace).toHaveBeenCalledWith('/(main)');
    });

    it('carries the email to the code step', async () => {
        await routePostAuth({ otpToken: 'otp-stub', mfaType: 'totp' }, 'jo@accelit.com.au');

        expect(api.otpToken).toBe('otp-stub');
        expect(session.start).not.toHaveBeenCalled();
        expect(router.push).toHaveBeenCalledWith(expect.objectContaining({
            pathname: '/(auth)/otp',
            params: expect.objectContaining({ email: 'jo@accelit.com.au', mfaType: 'totp' }),
        }));
    });
});

describe('abandonOtp', () => {
    // Reached from "Sign in with password" on the unlock screen, the stored
    // session is still there to come back to. Backing out must not delete it.
    it('drops the stub and leaves a locked session alone', () => {
        api.setOtpToken('otp-stub');

        abandonOtp();

        expect(api.otpToken).toBeNull();
        expect(session.end).not.toHaveBeenCalled();
    });
});

describe('clearAuth', () => {
    it('ends the session and forgets the remembered device', async () => {
        store.data.set(STORAGE_KEYS.mfaDeviceToken, 'device-token');

        await clearAuth();

        expect(session.end).toHaveBeenCalledTimes(1);
        expect(store.data.has(STORAGE_KEYS.mfaDeviceToken)).toBe(false);
        expect(sync.onSessionEnded).toHaveBeenCalledWith({ explicit: false });
    });
});
```

Update `tests/rootLayout.test.js`:

1. In the `vi.hoisted` object, replace `token: null,` with `status: 'none',` and `restore: vi.fn(),` with `sessionStatus: vi.fn(),`.
2. Replace

```js
vi.mock('../app/services/api', () => ({
    default: { restore: mocks.restore, me: mocks.me },
}));
```

with

```js
vi.mock('../app/services/api', () => ({
    default: { me: mocks.me },
}));

vi.mock('../app/services/session', () => ({ status: mocks.sessionStatus }));
```

3. Replace the comment `// restore() → setIsChecking → provider effect → me() → setStaff is a chain` with `// status() → setIsChecking → provider effect → me() → setStaff is a chain`.
4. Replace the comment and helper

```js
// What api.restore() and api.me() will answer, then the navigation that
// triggers the root layout's auth check.
const navigate = async ({ segments, token, profile }) => {
    mocks.token = token;
```

with

```js
// What session.status() and api.me() will answer, then the navigation that
// triggers the root layout's auth check.
const navigate = async ({ segments, status, profile }) => {
    mocks.status = status;
```

5. In `beforeEach`, replace `mocks.restore.mockImplementation(async () => mocks.token);` with `mocks.sessionStatus.mockImplementation(async () => mocks.status);`.
6. In the four existing tests, replace every `token: 'tok'` with `status: 'unlocked'` and every `token: null` with `status: 'none'`.
7. Append inside `describe('RootLayout staff profile', ...)`:

```js
    it('sends a locked session outside (auth) to the unlock screen', async () => {
        await mount();
        await navigate({ segments: ['client', '[id]'], status: 'locked', profile: null });

        expect(mocks.replace).toHaveBeenCalledWith('/(auth)/unlock');
        expect(mocks.me).not.toHaveBeenCalled();
    });

    it('leaves a locked session on the login screen it chose', async () => {
        await mount();
        await navigate({ segments: ['(auth)', 'login'], status: 'locked', profile: null });

        expect(mocks.replace).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api.test.js tests/authFlow.test.js tests/rootLayout.test.js`

Expected failures:
- `api.test.js`: `api.setOtpToken is not a function`.
- `authFlow.test.js`: `completeSignIn` / `abandonOtp` are not exported.
- `rootLayout.test.js`: most tests fail. The layout still calls `api.restore()`, which the mock no longer provides, so every navigation looks signed out.

- [ ] **Step 3: Rewrite the top of `api.js`**

In `app/services/api.js`, replace everything from the first line down to and including the `me()` method (the end of the `// ─── Auth ───` section) with:

```js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import endpoints from '../constants/endpoints';
import { STORAGE_KEYS, ALL_AUTH_KEYS } from '../constants/storageKeys';
import { isIpRefusal, errorMessage } from '../utils/apiErrors';
import { onSessionEnded } from '../utils/contactSync';
import * as session from './session';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://app.accelit.online';

// The admin host. These routes are registered inside Route::domain($adminDomain),
// so pointing at the client-portal host returns 404 for every one of them.
const API_ROOT = `${API_BASE_URL}/api`;

// Tells /login and /check-otp this is the staff app, which gets its own kind
// of token: a 30-day session that a web sign-in leaves alone, plus an
// address-book-only token for contact sync. Every other route ignores it.
export const CLIENT_HEADER = { 'X-Accel-Client': 'staff-app' };

class ApiService {
    constructor() {
        // The stub from POST /login when MFA is on. It can only exchange a
        // code, so it lives here in memory and nowhere else. The session token
        // is session.js's.
        this.otpToken = null;
        this.deviceToken = null;
    }

    setOtpToken(otpToken) {
        this.otpToken = otpToken || null;
    }

    setDeviceToken(deviceToken) {
        this.deviceToken = deviceToken || null;
    }

    // The remembered-device token only matters to POST /login, so the sign-in
    // screen loads it before offering the form.
    async loadDeviceToken() {
        this.setDeviceToken(await AsyncStorage.getItem(STORAGE_KEYS.mfaDeviceToken));
    }

    async request(path, { method = 'GET', body, query, auth = true } = {}) {
        const url = new URL(`${API_ROOT}/${path}`);

        // Never send a literal "false": several controllers read boolean flags
        // with plain PHP truthiness, where the string "false" is true.
        if (query) {
            Object.entries(query).forEach(([key, value]) => {
                if (value === undefined || value === null || value === '' || value === false) return;
                url.searchParams.append(key, String(value));
            });
        }

        const headers = { Accept: 'application/json', ...CLIENT_HEADER };
        // Mid-MFA the stub is the only credential; otherwise the session's.
        const sessionToken = this.otpToken ? null : session.currentToken();
        const bearer = auth ? this.otpToken || sessionToken : null;

        if (body) headers['Content-Type'] = 'application/json';
        if (bearer) headers.Authorization = `Bearer ${bearer}`;
        if (this.deviceToken) headers['X-MFA-Device-Token'] = this.deviceToken;

        let response;

        try {
            response = await fetch(url.toString(), {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
        } catch (networkError) {
            const error = new Error('Could not reach the server. Check the VPN connection.');
            error.status = 0;
            error.isNetwork = true;
            throw error;
        }

        const text = await response.text();
        let parsed = null;

        if (text) {
            try {
                parsed = JSON.parse(text);
            } catch {
                parsed = null;
            }
        }

        if (response.ok) return parsed;

        return this.handleFailure(response, parsed, {
            sentSession: !!bearer && bearer === sessionToken,
            sentStub: !!bearer && bearer === this.otpToken,
        });
    }

    // Only a 401 on a request that carried a token means that token is dead.
    // The login route answers a wrong password with 401 as well, and bouncing
    // to the login screen on that remounts the form and loses the error before
    // anyone reads it.
    async handleFailure(response, body, { sentSession = false, sentStub = false } = {}) {
        if (response.status === 401 && (sentSession || sentStub)) {
            await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
            this.setOtpToken(null);

            if (sentSession) {
                // Expired or revoked. The stored copy is as dead as this one,
                // so it goes too, or every open would ask for Face ID for it.
                await session.end();
                // Not signed out: the worker loses its token, the phone keeps
                // the contacts it already has.
                await onSessionEnded({ explicit: false });
            }

            router.replace(sentSession ? '/(auth)/login?reason=expired' : '/(auth)/login');
        }

        // Off the VPN. Sending the user to the login screen would have them
        // retyping a password that cannot succeed from where they are standing.
        if (response.status === 403 && isIpRefusal(body)) {
            router.replace('/(auth)/vpn');
        }

        const error = new Error(errorMessage(body, `Request failed (${response.status})`));
        error.status = response.status;
        error.body = body;
        throw error;
    }

    // ─── Auth ───────────────────────────────────────────────────────────────
    ipCheck() {
        return this.request(endpoints.LOGIN_IP_CHECK, { auth: false });
    }

    login(email, password) {
        return this.request(endpoints.LOGIN, {
            method: 'POST',
            auth: false,
            body: { email, password },
        });
    }

    checkOtp(otp, rememberDevice) {
        return this.request(endpoints.CHECK_OTP, {
            method: 'POST',
            body: { otp, remember_device: !!rememberDevice },
        });
    }

    switchMfaMethod(method) {
        return this.request(endpoints.SWITCH_MFA_METHOD, {
            method: 'POST',
            body: { method },
        });
    }

    logout() {
        return this.request(endpoints.LOGOUT, { method: 'POST' });
    }

    // Returns a bare object, not {data: ...} — the controller unwraps it.
    me() {
        return this.request(endpoints.ME);
    }
```

Everything after `me()` (Clients, Tickets, Everything else, and the export) stays as it is.

- [ ] **Step 4: Rewrite `authFlow.js`**

Replace `app/utils/authFlow.js` with:

```js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import api, { API_BASE_URL } from '../services/api';
import * as session from '../services/session';
import { onSessionStarted, onSessionEnded } from './contactSync';
import { STORAGE_KEYS, ALL_AUTH_KEYS } from '../constants/storageKeys';

// A full sign-in: the password (and the code, if asked) accepted and a
// staff_app token issued.
export async function completeSignIn(response, email) {
    api.setOtpToken(null);
    await session.start(response, email);

    // The worker runs with no biometric check, from plain app-private prefs,
    // so it gets the address-book-only token and never the full one.
    if (response.contacts_token) await onSessionStarted(response.contacts_token, API_BASE_URL);

    if (response.device_token) {
        await AsyncStorage.setItem(STORAGE_KEYS.mfaDeviceToken, response.device_token);
        api.setDeviceToken(response.device_token);
    }
}

// Back out of the code step. Only the stub goes: a locked session the user
// left through "Sign in with password" must still be there next time.
export function abandonOtp() {
    api.setOtpToken(null);
}

// Sign-out.
export async function clearAuth() {
    await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
    api.setOtpToken(null);
    api.setDeviceToken(null);
    await session.end();
    await onSessionEnded({ explicit: false });
}

// A login response is one of two shapes: a full token, or an OTP stub plus the
// MFA details needed to prompt for a code.
export async function routePostAuth(response, email) {
    if (response?.token) {
        await completeSignIn(response, email);
        router.replace('/(main)');

        return;
    }

    if (response?.otpToken) {
        // The stub authenticates the OTP exchange and nothing else — it carries
        // the 'otp' ability, so every other endpoint rejects it with a 403.
        api.setOtpToken(response.otpToken);

        router.push({
            pathname: '/(auth)/otp',
            params: {
                email: email ?? '',
                mfaType: response.mfaType ?? '',
                maskedMFA: response.maskedMFA ?? '',
                availableMethods: JSON.stringify(response.availableMethods ?? []),
            },
        });
    }
}
```

- [ ] **Step 5: Drop the old token key**

In `app/constants/storageKeys.js`:
- Delete these three lines:

```js
    // Pre-1.1.0 home of the full token. Task 7 removes this alias; until then
    // api.js still reads it.
    token: 'authToken',
```

- Replace the `ALL_AUTH_KEYS` block with:

```js
// Cleared on sign-out and on a 401 of a request that carried a token.
export const ALL_AUTH_KEYS = [STORAGE_KEYS.mfaDeviceToken];
```

In `app/utils/contactSync.js`, replace

```js
// restore() runs on every navigation; native only needs telling when the
// token actually changes.
```

with

```js
// Native only needs telling when the token actually changes.
```

- [ ] **Step 6: Update the sign-in call sites**

In `app/(auth)/login.js`:
- In the mount effect, replace `await api.restore();` with `await api.loadDeviceToken();`.
- In `submit`, replace `await routePostAuth(response);` with `await routePostAuth(response, email.trim());`.

In `app/(auth)/otp.js`:
- Replace `import { persistAuth, clearAuth } from '../utils/authFlow';` with `import { completeSignIn, abandonOtp } from '../utils/authFlow';`.
- In `submit`, replace `await persistAuth(response.token, response.device_token);` with `await completeSignIn(response, params.email);`.
- Replace the `cancel` callback with:

```js
    const cancel = useCallback(() => {
        abandonOtp();
        router.replace('/(auth)/login');
    }, []);
```

- Add `params.email` to `submit`'s dependency list: `}, [busy, code, remember, params.email]);`

- [ ] **Step 7: Route by session status**

In `app/_layout.js`:
- Replace `import api from './services/api';` with:

```js
import * as session from './services/session';
import { routeFor } from './utils/sessionRules';
```

- Inside `checkAuth`, replace:

```js
                // Restore the token on every navigation rather than only on the
                // index route: booting straight into a detail screen via a deep
                // link would otherwise leave the client unauthenticated and 401
                // every request.
                const token = await api.restore();

                setAuthenticated(!!token);

                if (!token && !inAuthGroup) {
                    router.replace('/(auth)/login');
                }
                // Deliberately no redirect out of (auth) for an authenticated
                // user — the OTP screen lives there and is reached mid-login.
```

with:

```js
                // Ask on every navigation rather than only on the index route:
                // booting straight into a detail screen via a deep link must
                // still land on unlock or sign-in first.
                const status = await session.status();

                setAuthenticated(status === 'unlocked');

                // Never out of (auth): the code step and "Sign in with password"
                // both live there on purpose.
                const target = routeFor({ status, inAuthGroup });

                if (target) router.replace(target);
```

Replace `app/index.js` with:

```js
import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import * as session from './services/session';
import { routeFor } from './utils/sessionRules';

export default function Index() {
    const [target, setTarget] = useState(null);

    useEffect(() => {
        (async () => {
            const status = await session.status();

            setTarget(routeFor({ status, inAuthGroup: false }) ?? '/(main)');
        })();
    }, []);

    if (!target) return null;

    return <Redirect href={target} />;
}
```

- [ ] **Step 8: Run the tests and check for stale references**

Run: `npm test`
Expected: all passed. That is 27 files: the 26 before, plus `authFlow.test.js`.

Run: `grep -rnE "api\.restore|setToken\(|persistAuth|STORAGE_KEYS\.token\b" app tests`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add app/services/api.js app/utils/authFlow.js app/constants/storageKeys.js app/utils/contactSync.js "app/(auth)/login.js" "app/(auth)/otp.js" app/_layout.js app/index.js tests/api.test.js tests/authFlow.test.js tests/rootLayout.test.js
git commit -F - <<'EOF'
feat: sign-in, requests and routing go through the session

Requests name the staff app so sign-in mints app tokens. The contact
worker gets the address-book token only. A dead session's 401 deletes
the stored copy too, and backing out of the code step no longer wipes
a locked session.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: Lock after five minutes away

**Files:**
- Create: `app/utils/appLock.js`
- Modify: `app/_layout.js` (import, and one call in `RootLayoutInner`)
- Modify: `tests/rootLayout.test.js` (mock the hook)
- Test: `tests/appLock.test.js`

**Interfaces:**
- Consumes:
  - Task 4: `shouldLock`, `routeFor`.
  - Task 5: `session.currentToken()`, `session.lock()`, `session.status()`.
- Produces:
  - `createLockListener(clock?: () => number): (state: string) => Promise<void>`
  - default export `useAppLock(): void`

- [ ] **Step 1: Write the failing test**

Create `tests/appLock.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    token: 'app-token',
    status: 'locked',
    now: 0,
    lock: vi.fn(),
    replace: vi.fn(),
}));

vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() }, Platform: { OS: 'ios' } }));
vi.mock('expo-router', () => ({ router: { replace: mocks.replace } }));
vi.mock('../app/services/session', () => ({
    currentToken: () => mocks.token,
    lock: () => { mocks.lock(); mocks.token = null; },
    status: async () => mocks.status,
}));

import { createLockListener } from '../app/utils/appLock';
import { LOCK_AFTER_MS } from '../app/utils/sessionRules';

let onChange;

const at = (ms) => { mocks.now = ms; };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.token = 'app-token';
    mocks.status = 'locked';
    mocks.now = 0;
    onChange = createLockListener(() => mocks.now);
});

describe('app lock', () => {
    it('locks after five minutes in the background and asks for biometrics', async () => {
        await onChange('background');
        at(LOCK_AFTER_MS);
        await onChange('active');

        expect(mocks.lock).toHaveBeenCalledTimes(1);
        expect(mocks.replace).toHaveBeenCalledWith('/(auth)/unlock');
    });

    it('does not lock after a quick switch away', async () => {
        await onChange('background');
        at(LOCK_AFTER_MS - 1);
        await onChange('active');

        expect(mocks.lock).not.toHaveBeenCalled();
        expect(mocks.replace).not.toHaveBeenCalled();
    });

    // iOS turns the app inactive for its own Face ID sheet. Counting that as
    // time away would lock the app in the middle of unlocking it.
    it('never counts inactive as time away', async () => {
        await onChange('inactive');
        at(LOCK_AFTER_MS * 10);
        await onChange('active');

        expect(mocks.lock).not.toHaveBeenCalled();
    });

    it('sends a phone with no stored session to sign-in', async () => {
        mocks.status = 'none';

        await onChange('background');
        at(LOCK_AFTER_MS);
        await onChange('active');

        expect(mocks.replace).toHaveBeenCalledWith('/(auth)/login');
    });

    it('leaves a signed-out or mid-code app alone', async () => {
        mocks.token = null;

        await onChange('background');
        at(LOCK_AFTER_MS);
        await onChange('active');

        expect(mocks.lock).not.toHaveBeenCalled();
        expect(mocks.replace).not.toHaveBeenCalled();
    });

    it('starts the clock afresh on every trip away', async () => {
        await onChange('background');
        at(1000);
        await onChange('active');
        at(LOCK_AFTER_MS * 2);
        await onChange('active');

        expect(mocks.lock).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/appLock.test.js`
Expected: FAIL, "Failed to resolve import ../app/utils/appLock".

- [ ] **Step 3: Write the listener and hook**

Create `app/utils/appLock.js`:

```js
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import * as session from '../services/session';
import { routeFor, shouldLock } from './sessionRules';

// Remembers when the app went to the background. Coming back after
// LOCK_AFTER_MS, it drops the in-memory token and routes to unlock, or to
// sign-in on a phone with no stored session. Only 'background' starts the
// clock: iOS turns the app 'inactive' for its own Face ID sheet and for
// Control Centre.
export function createLockListener(clock = Date.now) {
    let backgroundedAt = null;

    return async function onAppStateChange(state) {
        if (state === 'background') {
            backgroundedAt = clock();

            return;
        }

        if (state !== 'active') return;

        const since = backgroundedAt;

        backgroundedAt = null;

        if (!session.currentToken() || !shouldLock(since, clock())) return;

        session.lock();

        const target = routeFor({ status: await session.status(), inAuthGroup: false });

        if (target) router.replace(target);
    };
}

// The web harness has no biometrics to come back through, so it never locks.
export default function useAppLock() {
    useEffect(() => {
        if (Platform.OS === 'web') return undefined;

        const subscription = AppState.addEventListener('change', createLockListener());

        return () => subscription.remove();
    }, []);
}
```

In `app/_layout.js`:
- Add `import useAppLock from './utils/appLock';` below the `useContactSyncRefresh` import.
- In `RootLayoutInner`, directly above `useContactSyncRefresh(authenticated && !inAuthGroup);`, add:

```js
    useAppLock();
```

In `tests/rootLayout.test.js`, below `vi.mock('../app/utils/useContactSyncRefresh', ...)`, add:

```js
vi.mock('../app/utils/appLock', () => ({ default: () => {} }));
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/appLock.test.js tests/rootLayout.test.js`
Expected: PASS.

Run: `npm test`
Expected: 28 files passed.

- [ ] **Step 5: Commit**

```bash
git add app/utils/appLock.js app/_layout.js tests/appLock.test.js tests/rootLayout.test.js
git commit -F - <<'EOF'
feat: lock the app after five minutes in the background

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 9: The sign-in form remembers the email and says why it is showing; the VPN screen returns to `/`

**Files:**
- Modify: `app/(auth)/login.js`
- Modify: `app/(auth)/vpn.js:31`
- Test: `tests/loginScreen.test.js`

**Interfaces:**
- Consumes:
  - Task 5: `session.lastEmail()`, `session.label()`.
  - Task 4: `reasonMessage()`.
  - Task 7: `api.loadDeviceToken()`, `routePostAuth(response, email)`.
- Produces: `/(auth)/login` reads a `reason` route param (`expired` | `changed`).

- [ ] **Step 1: Write the failing test**

Create `tests/loginScreen.test.js`:

```js
/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    params: {},
    inputs: {},
    remembered: 'jo@accelit.com.au',
    label: 'Face ID',
    replace: vi.fn(),
    push: vi.fn(),
    ipCheck: vi.fn(async () => ({ allowed: true })),
    loadDeviceToken: vi.fn(async () => {}),
    login: vi.fn(async () => ({ token: 'app-token' })),
    routePostAuth: vi.fn(async () => {}),
}));

vi.mock('react-native', async () => {
    const R = await import('react');
    const el = (tag, map = () => ({})) => ({ children, ...props }) => R.createElement(tag, map(props), children);

    return {
        View: el('div'),
        Text: el('span'),
        Image: () => R.createElement('img'),
        ScrollView: el('div'),
        KeyboardAvoidingView: el('div'),
        ActivityIndicator: el('progress'),
        TouchableOpacity: el('button', (p) => ({ onClick: p.onPress, disabled: p.disabled, 'aria-label': p.accessibilityLabel })),
        // Keep each field's props, so a test can type by calling onChangeText.
        TextInput: (props) => {
            mocks.inputs[props.textContentType] = props;

            return R.createElement('input', {
                readOnly: true,
                value: props.value ?? '',
                'data-kind': props.textContentType,
                'data-autofocus': String(!!props.autoFocus),
            });
        },
        StyleSheet: { create: (s) => s },
        Platform: { OS: 'ios' },
    };
});

vi.mock('react-native-safe-area-context', async () => {
    const R = await import('react');

    return { SafeAreaView: ({ children }) => R.createElement('div', null, children) };
});

vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('expo-router', () => ({
    router: { replace: mocks.replace, push: mocks.push },
    useLocalSearchParams: () => mocks.params,
}));
vi.mock('../app/services/api', () => ({
    default: { ipCheck: mocks.ipCheck, loadDeviceToken: mocks.loadDeviceToken, login: mocks.login },
}));
vi.mock('../app/utils/authFlow', () => ({ routePostAuth: mocks.routePostAuth }));
vi.mock('../app/services/session', () => ({
    lastEmail: async () => mocks.remembered,
    label: async () => mocks.label,
}));

import LoginScreen from '../app/(auth)/login';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const settle = async () => {
    for (let i = 0; i < 4; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    }
};

const mount = async () => {
    await act(async () => { root.render(React.createElement(LoginScreen)); });
    await settle();
};

const field = (kind) => container.querySelector(`input[data-kind="${kind}"]`);

beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = {};
    mocks.inputs = {};
    mocks.remembered = 'jo@accelit.com.au';
    mocks.label = 'Face ID';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
});

describe('LoginScreen', () => {
    it('fills in the remembered email and starts in the password box', async () => {
        await mount();

        expect(field('username').value).toBe('jo@accelit.com.au');
        expect(field('password').dataset.autofocus).toBe('true');
    });

    it('starts empty on a first sign-in', async () => {
        mocks.remembered = '';

        await mount();

        expect(field('username').value).toBe('');
        expect(field('password').dataset.autofocus).toBe('false');
    });

    it('loads the remembered device before the password is sent', async () => {
        await mount();

        expect(mocks.loadDeviceToken).toHaveBeenCalledTimes(1);
    });

    it('says the session expired', async () => {
        mocks.params = { reason: 'expired' };

        await mount();

        expect(container.textContent).toContain('Your session expired — sign in again.');
    });

    it('says the biometrics changed, by name', async () => {
        mocks.params = { reason: 'changed' };

        await mount();

        expect(container.textContent).toContain('Face ID changed on this phone — sign in with your password.');
    });

    it('says nothing when there is no reason', async () => {
        await mount();

        expect(container.textContent).not.toContain('sign in again');
        expect(container.textContent).not.toContain('changed on this phone');
    });

    it('hands the email it signed in with to the sign-in flow', async () => {
        await mount();

        await act(async () => { mocks.inputs.password.onChangeText('secret-pass'); });
        await act(async () => {
            [...container.querySelectorAll('button')].find((b) => b.textContent === 'Sign in').click();
        });
        await settle();

        expect(mocks.login).toHaveBeenCalledWith('jo@accelit.com.au', 'secret-pass');
        expect(mocks.routePostAuth).toHaveBeenCalledWith({ token: 'app-token' }, 'jo@accelit.com.au');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/loginScreen.test.js`

Expected failures:
- the prefill test (the email is empty);
- `says the session expired` and `says the biometrics changed, by name`.

The last test and `loads the remembered device` pass already.

- [ ] **Step 3: Prefill the email and show the reason**

In `app/(auth)/login.js`:

1. Change the router import to `import { router, useLocalSearchParams } from 'expo-router';`, and add these below the `routePostAuth` import:

```js
import * as session from '../services/session';
import { reasonMessage } from '../utils/sessionRules';
```

2. At the top of `LoginScreen`, above `const [email, setEmail] = useState('');`, add:

```js
    const { reason } = useLocalSearchParams();
```

and below `const [showPassword, setShowPassword] = useState(false);` add:

```js
    const [notice, setNotice] = useState(null);
    const [prefilled, setPrefilled] = useState(false);
```

3. In the mount effect, replace:

```js
            try {
                await api.loadDeviceToken();

                const { allowed } = await api.ipCheck();
```

with:

```js
            try {
                await api.loadDeviceToken();

                const [remembered, label] = await Promise.all([session.lastEmail(), session.label()]);

                if (cancelled) return;

                setEmail(remembered);
                setPrefilled(!!remembered);
                setNotice(reasonMessage(reason, label));

                const { allowed } = await api.ipCheck();
```

4. Directly above `<View style={styles.card}>`, add:

```js
                    {notice ? (
                        <View style={styles.noticeRow}>
                            <Ionicons name="information-circle-outline" size={16} color={t.textSecondary} />
                            <Text style={styles.noticeText}>{notice}</Text>
                        </View>
                    ) : null}
```

5. On the password `TextInput` (the one with `textContentType="password"`), add the prop `autoFocus={prefilled}`.

6. In `StyleSheet.create`, after `subtitle: {...},`, add:

```js
    noticeRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginBottom: 14, paddingHorizontal: 4,
    },
    noticeText: { color: t.textSecondary, fontSize: 13, flex: 1 },
```

- [ ] **Step 4: Return from the VPN screen to `/`**

In `app/(auth)/vpn.js`, replace:

```js
                router.replace('/(auth)/login');
```

with:

```js
                // Back to the index, which picks the app, unlock or sign-in.
                // An unlocked session that dropped off the VPN should not be
                // asked for a password it doesn't need.
                router.replace('/');
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/loginScreen.test.js`
Expected: PASS (7 tests).

Run: `npm test`
Expected: 29 files passed.

- [ ] **Step 6: Commit**

```bash
git add "app/(auth)/login.js" "app/(auth)/vpn.js" tests/loginScreen.test.js
git commit -F - <<'EOF'
feat: login remembers the email and says why it is showing

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 10: Docs and the device checklist

**Files:**
- Modify: `README.md`
- Modify: `docs/api-contract.md`
- Create: `docs/biometric-unlock-verification.md`

**Interfaces:**
- Consumes: the finished behaviour of Tasks 1–9.
- Produces: docs only.

- [ ] **Step 1: README**

In `README.md`:

1. Replace

```
It makes **no backend changes**. Every endpoint it calls is one the Accel Online
web admin already calls — see [docs/api-contract.md](docs/api-contract.md) for
each one's exact shape, authorization and quirks.
```

with

```
It needs one backend change, to sign-in and token lifetimes (in `accelit`; see
[the design](docs/superpowers/specs/2026-09-30-app-sign-in-biometric-unlock-design.md)).
Every endpoint it calls is one the Accel Online web admin already calls — see
[docs/api-contract.md](docs/api-contract.md) for each one's exact shape,
authorization and quirks.
```

2. Directly above `## Passwords are displayed, never stored`, insert:

```
## Sign in once, then Face ID

The app sends `X-Accel-Client: staff-app` with every request. On `/login` and
`/check-otp` that gets it its own kind of token, so signing in on the phone no
longer signs you out of the web admin, or the other way round. Each kind still
has one session per person: signing in on a second phone ends the first
phone's session.

After a full sign-in the app's token lasts 30 days. On a phone with Face ID or a
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

```

3. Replace

```
- Nothing password-shaped goes into AsyncStorage. The only persisted values are
  the auth token, the remembered-device token, the theme and the staff profile
  with its TOTP seed stripped.
```

with

```
- Nothing password-shaped goes into AsyncStorage. The session token is in the
  Keychain / Keystore behind a biometric check, never in AsyncStorage. What
  AsyncStorage holds: the remembered-device token, the last sign-in email, a
  session marker with the token's expiry and nothing secret, the theme, and the
  staff profile with its TOTP seed stripped.
```

4. Directly below the code block containing `npx expo-doctor # config and dependency check`, insert:

```

Biometric unlock needs a development or EAS build, because
`expo-secure-store` and `expo-local-authentication` are native modules that
Expo Go lacks. It also needs a real phone: simulators and emulators do not
enforce the biometric check. The checklist is
[docs/biometric-unlock-verification.md](docs/biometric-unlock-verification.md).
On web (the Chrome harness) there is no lock; the token is kept in AsyncStorage
as before.
```

5. Replace

```
Nothing is created, edited or deleted anywhere in the app. It holds a
full-privilege admin token because that is the only kind the API mints — the
read-only property is the app's, not the token's.
```

with

```
Nothing is created, edited or deleted anywhere in the app. It holds a
full-privilege admin token because the API mints no read-only kind — the
read-only property is the app's, not the token's. The one narrower token is the
contact-sync worker's, which can read the address book and nothing else.
```

- [ ] **Step 2: API contract**

In `docs/api-contract.md`:

1. Replace the whole `- **Token abilities**: ...` bullet and the `- **Token TTL**: ...` bullet under "Conventions" with:

```
- **Token abilities**: a web sign-in mints `auth_token` with abilities `['*']`.
  A staff-app sign-in (request header `X-Accel-Client: staff-app` on
  `/login` or `/check-otp`) mints two: `staff_app` with `['*']`, and
  `staff_app_contacts` with `['address-book']`, which only satisfies
  `GET /api/address-book` (`token.can:address-book`) and gets a 403 everywhere
  else, broadcasting auth included. The OTP-stage token
  (`createToken('token', ['otp'])`) only satisfies routes gated
  `token.can:otp` (`POST /api/check-otp`, `POST /api/switch-mfa-method`) and is
  deleted once its code is accepted.
- **Revocation**: a successful sign-in revokes the user's earlier tokens of the
  same kind only: web (`auth_token`) or app (`staff_app` +
  `staff_app_contacts`). Signing in on one never ends the other
  (`AuthHelper::issueSessionTokens`).
- **Token TTL**: per token, in `personal_access_tokens.expires_at`
  (`sanctum.expiration` is `null`).
  - Web and OTP tokens: 600 minutes (`sanctum.default_token_minutes`, applied
    on create in `AppServiceProvider::boot`).
  - App tokens: 30 days (`sanctum.staff_app_token_days`).
  - A token issued before per-token expiry has no `expires_at`, and still dies
    600 minutes after `created_at`.
  - An expired token gets the same 401 as an invalid one.
```

2. In the `POST /api/login` section, directly below the line ending `call it right after storing the token.`, add:

```
- **Staff app** (`X-Accel-Client: staff-app`): the full-token branches also
  return `contacts_token` (address-book-only) and `expires_at` (ISO 8601,
  30 days out), alongside `token` and `user`.
```

3. In the `POST /api/check-otp` section, directly below the line `` `device_token` is present **only** if `remember_device: true` was sent.``, add:

```
  With `X-Accel-Client: staff-app` the response also carries `contacts_token`
  and `expires_at`, as on `/api/login`.
```

4. In the `POST /api/logout` section, directly below the bullet that ends `*this* request, not all of the user's tokens/devices.`, add:

```
- When that token is a `staff_app` token, the user's `staff_app_contacts`
  tokens go with it.
```

5. In the `GET /api/address-book` section, directly below `` `app/Http/Controllers/AddressBookController.php:14-102`.``, add:

```
Route middleware: `auth:sanctum` + `token.can:address-book`, outside the
`token.can:*` group, so the staff app's contacts token reaches it. Full tokens
pass too, since `*` covers every ability.
```

- [ ] **Step 3: Device checklist**

Create `docs/biometric-unlock-verification.md`:

```markdown
# Biometric unlock — device verification

What you need:

- **Backend:** branch `feat/app-sessions` running on a host the phone reaches
  over the VPN (staging).
- **App:** a build of 1.1.0 that contains `expo-secure-store` and
  `expo-local-authentication`, made with `eas build --profile development` or
  `preview`. Expo Go will not do.
- **Phones:** an iPhone with Face ID and an Android phone with a fingerprint
  enrolled. Simulators and emulators do not enforce the biometric check and
  cannot pass this list.

Handy query on the staging database:

    select id, name, abilities, created_at, expires_at, last_used_at
    from personal_access_tokens
    where tokenable_type = 'App\Models\Staff' and tokenable_id = <your staff id>
    order by id desc;

| # | Criterion | How | Pass when |
|---|---|---|---|
| 1 | First sign-in stores the session (iPhone) | fresh install, sign in with the password (and code) | lands on Dashboard; query shows one `staff_app` and one `staff_app_contacts` row, `expires_at` 30 days out |
| 2 | First sign-in stores the session (Android) | the same on Android | one fingerprint prompt titled "Unlock Accel Staff" right after sign-in; then Dashboard |
| 3 | Cold start asks for biometrics | swipe the app away, open it | the unlock screen shows your email; the prompt appears by itself; a match lands on Dashboard with no password |
| 4 | Cancel keeps the session | cancel the prompt | the unlock screen stays, no error; "Unlock with …" prompts again |
| 5 | The password is always there | on the unlock screen tap "Sign in with password"; if a code is asked, tap "Back to sign in"; close and reopen the app | the unlock screen and prompt come back |
| 6 | A short trip away does not lock | switch to another app for about a minute, come back | still in the app, no prompt |
| 7 | Five minutes away locks | switch away for 5+ minutes, come back | unlock screen and prompt |
| 8 | The Face ID sheet does not lock | unlock several times in a row | never a second prompt after a match |
| 9 | Web and app coexist | sign in on the web admin, use the app, sign in on the app again, use the web | neither is signed out; query shows one `auth_token` and one `staff_app` pair |
| 10 | A second phone ends the first | sign in on the other phone, then pull to refresh on the first | the first lands on sign-in with "Your session expired — sign in again." |
| 11 | Changed biometrics force the password | add a fingerprint (or an alternate appearance), open the app | sign-in with "Face ID changed on this phone — sign in with your password." (or "Fingerprint …"), email filled in |
| 12 | No biometrics: password every time | on a phone with none enrolled, sign in, then close and reopen | sign-in screen, email filled in, cursor in the password box; no unlock screen |
| 13 | Server-side expiry | set the `staff_app` row's `expires_at` to yesterday, open the app and unlock | the first request lands on sign-in with "Your session expired — sign in again."; reopening does not prompt again |
| 14 | Sign out | Sign out, reopen | sign-in with the email filled in; query shows no `staff_app` or `staff_app_contacts` rows |
| 15 | Contact sync while locked (Android) | Address Book switch on, then leave the app locked for over an hour | `adb logcat -s AccelContacts` shows a successful sync; `last_used_at` moves on the `staff_app_contacts` row |
| 16 | The contacts token is narrow | mint one in tinker: `Staff::find(<id>)->createToken('staff_app_contacts', ['address-book'])->plainTextToken`; `curl -H "Authorization: Bearer <token>"` against `/api/me` and `/api/address-book` | `/api/me` 403, `/api/address-book` 200 |
| 17 | Off the VPN after unlocking | unlock, turn the VPN off, pull to refresh, turn it back on | the VPN screen, then back into the app with no password |
| 18 | Upgrade from 1.0.0 | install the 1.0.0 build, sign in, install 1.1.0 over it, open | sign-in once (the old token is gone); after that, row 3 |
```

- [ ] **Step 4: Check the docs**

Run: `grep -n "no backend changes\|only kind the API mints\|expiration') = 600" README.md docs/api-contract.md`
Expected: no output.

Run: `npm test`
Expected: 29 files passed.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/api-contract.md docs/biometric-unlock-verification.md
git commit -F - <<'EOF'
docs: separate app sessions, biometric unlock and the device checklist

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 11: Hand-off for device verification (the user runs this)

This task is for the user. The executor stops after Task 10 and reports.

- [ ] **Step 1: Web smoke test, against the current backend**
  - Run `npm run web` (or `npx expo start --web`) against Valet, as in the "Verify staff app in Chrome web" memory.
  - Sign in. The primary `accelit` checkout is still on `staging`, so it ignores the header and sends no `contacts_token` or `expires_at`.
  - Expect: sign-in works; a reload stays signed in; sign-out returns to the login screen with the email filled in.
  - This proves the app tolerates an old backend, which is the rollout-order guarantee.
- [ ] **Step 2: Backend on staging.** Deploy `feat/app-sessions` to staging. That is the user's call.
- [ ] **Step 3: App builds.** Run `eas build --profile development --platform all`. Development builds point at staging (runtime 1.1.0), where no OTA update reaches 1.0.0 builds.
- [ ] **Step 4: Run the device checklist.** Work through every row of `docs/biometric-unlock-verification.md` on a real iPhone and a real Android phone.
