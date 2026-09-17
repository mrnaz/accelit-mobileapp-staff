# Contact sync — device verification

Needs an Android build that contains the native module (`eas build --profile
development --platform android`, or `preview`). Expo Go will not do. Use a
phone signed in to a Google account, on the VPN, with `adb` attached.

Handy queries:

```bash
# our raw contacts
adb shell content query --uri content://com.android.contacts/raw_contacts \
  --projection _id:account_type:account_name:sourceid:sync1:version:deleted \
  --where "account_type='com.accelit.staffapp'"
# everyone else's (count before and after every step below: it must not change)
adb shell content query --uri content://com.android.contacts/raw_contacts \
  --projection _id:account_type:version --where "account_type!='com.accelit.staffapp'"
adb shell dumpsys account | grep -A2 com.accelit.staffapp
adb shell dumpsys jobscheduler | grep -i -A12 accelit      # WorkManager's periodic job, 1 h
adb logcat -s AccelContacts WM-WorkerWrapper
```

| # | Criterion | How | Pass when |
|---|---|---|---|
| 1 | Enabling creates the account | Address Book → switch on → allow | `dumpsys account` lists `Accel Staff` / `com.accelit.staffapp` |
| 2 | Initial sync pulls the directory | watch logcat, then query ours | row count equals distinct people in `GET /api/address-book` |
| 3 | Contact visible in Contacts | open the Contacts app, search a directory name | found |
| 4 | Owned by us, not Google | query ours | every row `account_type=com.accelit.staffapp`; none of ours under `com.google` |
| 5 | Caller ID | call the phone from a directory number not otherwise saved | dialler shows the directory name |
| 6 | Aggregation | save a directory person in Google contacts with the same number | one entry in Contacts; "linked contacts" shows two sources; both raw rows still exist |
| 7 | One-hour periodic job | `dumpsys jobscheduler` | one job for the app, period 1 h, network required |
| 8 | Deferral tolerated | `adb shell dumpsys deviceidle force-idle`, wait, `unforce` | no crash; next run reconciles normally |
| 9 | New server contact appears | add a contact in the web admin, pull to refresh | new row in ours |
| 10 | Changed contact updates | change a phone number in the web admin, pull to refresh | same `_id`, new `sync1`, new number in Contacts |
| 11 | Deleted contact disappears | delete it in the web admin, pull to refresh | row gone (not `deleted=1`) |
| 12 | Unchanged directory, no writes | note every `version` of ours, pull to refresh twice | all `version` values identical |
| 13 | No duplicates | toggle off/on, refresh five times | `sourceid` values unique |
| 14 | Only our rows touched | run the "everyone else" query before and after 9–13 | identical output |
| 15 | Third-party raw contact untouched under aggregation | after 6, change then delete that person on the server | Google raw contact's `version` unchanged and still present |
| 16 | Network failure keeps contacts | airplane mode, pull to refresh | ours unchanged; caption "Could not reach the server" |
| 17 | 401 keeps contacts | revoke the token server-side (or wait 10 h), bring app to foreground | app returns to login; ours unchanged |
| 18 | Not on contacts.google.com | Settings → Accounts → Google → sync now; check the website | directory-only people absent |
| 19 | Google sync does not upload ours | same as 18 plus proxy capture | no request carrying directory names/numbers |
| 20 | Removing the account removes only ours | Settings → Accounts → Accel Staff → remove | ours empty; "everyone else" identical; switch shows off on next open |
| 21 | Uninstall cleans up | `adb uninstall com.accelit.staffapp` | account gone from `dumpsys account`; ours empty |
| 22 | Reinstall recreates cleanly | install, sign in, switch on | as 1–4, no duplicates |
| 23 | No cloud backup | `adb shell bmgr backupnow com.accelit.staffapp` | "Backup is not allowed" |
| 24 | No third-party upload | run 1–13 behind mitmproxy | only requests are to the Accel API host |
| 25 | Sign-out removes the directory | Sign out | account gone; ours empty |
| 26 | Permission denial is harmless | deny the prompt | switch off with explanation; rest of app works |
| 27 | Read-only in Contacts (stub sync adapter) | open one of ours in Contacts and try to edit | edit is refused or lands in another account; our raw row unchanged. **If ours do not appear at all, or the account misbehaves, remove `StubSyncService` and its manifest entry and re-test.** |

Known limits, by design:

- The session token lasts 600 minutes and cannot be refreshed, so background
  sync works for about ten hours after each login and resumes at the next one.
- Off the VPN every sync fails and is retried; contacts stay as they were.
- A sync that would delete everything, or more than half of 20+, waits for a
  second identical result before deleting (row 11 on a tiny test directory may
  need two refreshes).
