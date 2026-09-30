# Biometric unlock — device verification

What you need:

- **Backend:** branch `feat/app-sessions` running on a host the phone reaches
  over the VPN (staging).
- **App:** a build of 1.1.0 that contains `expo-secure-store` and
  `expo-local-authentication`, made with `eas build --profile development`
  (development builds point at staging; `preview` points at production, which
  doesn't have the backend change). Expo Go will not do.
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
| 8 | Back doesn't bypass the lock | open a client or a ticket, switch away for 5+ minutes, come back; on the unlock screen press Android back, or swipe from the left edge on iPhone | stays on the unlock screen; only a match or "Sign in with password" leaves it |
| 9 | The Face ID sheet does not lock | unlock several times in a row | never a second prompt after a match |
| 10 | Web and app coexist | sign in on the web admin, use the app, sign in on the app again, use the web | neither is signed out; query shows one `auth_token` and one `staff_app` pair |
| 11 | A second phone ends the first | sign in on the other phone, then pull to refresh on the first | the first lands on sign-in with "Your session expired — sign in again." |
| 12 | Changed biometrics force the password | add a fingerprint (or an alternate appearance), open the app | sign-in with "Face ID changed on this phone — sign in with your password." (or "Fingerprint …"), email filled in |
| 13 | No biometrics: password every time | on a phone with none enrolled, sign in, then close and reopen | sign-in screen, email filled in, cursor in the password box; no unlock screen |
| 14 | Server-side expiry | set the `staff_app` row's `expires_at` to yesterday, open the app and unlock | the first request lands on sign-in with "Your session expired — sign in again."; reopening does not prompt again |
| 15 | Sign out | Sign out, reopen | sign-in with the email filled in; query shows no `staff_app` or `staff_app_contacts` rows |
| 16 | Contact sync while locked (Android) | Address Book switch on, then leave the app locked for over an hour | `adb logcat -s AccelContacts WM-WorkerWrapper` shows a SUCCESS result for the contact-sync worker; `last_used_at` moves on the `staff_app_contacts` row |
| 17 | The contacts token is narrow | mint one in tinker: `Staff::find(<id>)->createToken('staff_app_contacts', ['address-book'])->plainTextToken`; `curl -H "Authorization: Bearer <token>"` against `/api/me` and `/api/address-book` | `/api/me` 403, `/api/address-book` 200 |
| 18 | Off the VPN after unlocking | unlock, turn the VPN off, pull to refresh, turn it back on | the VPN screen, then back into the app with no password |
| 19 | Upgrade from 1.0.0 | install the 1.0.0 build, sign in, install 1.1.0 over it, open | sign-in once (the old token is gone); after that, row 3 |
