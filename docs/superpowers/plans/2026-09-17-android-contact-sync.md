# Android Contact Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project the staff directory (`GET /api/address-book`) into Android's Contacts Provider as raw contacts owned by an app-specific account, refreshed hourly by WorkManager, switched on from the Address Book screen.

**Architecture:** A local Expo module (`modules/accel-contacts/`, Kotlin, autolinked) owns everything Android-side: a stub account authenticator, a `CoroutineWorker` that fetches the directory itself, a pure diff, and the only class allowed to touch `ContactsContract`. The mapping between server id and raw contact lives in the raw contact's own `SOURCE_ID`/`SYNC1` columns, so there is no local database. JS only flips the feature on/off, hands the bearer token to native, and asks for a refresh at useful moments.

**Tech Stack:** Expo 54 (CNG, no `android/` dir), Expo Modules API (Kotlin), AndroidX WorkManager 2.9.1, `HttpURLConnection`, `org.json`, JUnit 4, React Native 0.81, vitest 2.

**Spec:** `docs/superpowers/specs/2026-09-17-android-contact-sync-design.md` — read it before any task.

## Global Constraints

- **Identifiers, verbatim:** `ACCOUNT_TYPE = "com.accelit.staffapp"`, `ACCOUNT_NAME = "Accel Staff"`, periodic work `accel-contact-sync`, one-off work `accel-contact-sync-now`, native module name `AccelContacts`, Kotlin package `com.accelit.staffapp.contacts`.
- **Own account only.** Every Contacts Provider query, update and delete is scoped to our account type and name. `ContactsStore` is the only class that imports `android.provider.ContactsContract`. Never read or store `CONTACT_ID`.
- **Failure never deletes.** Any non-200, network error, or body that is not a fully valid JSON array means zero provider writes.
- **No backend changes.** Only `GET /api/address-book` is called.
- **No new npm dependencies.** Gradle adds only `androidx.work:work-runtime-ktx:2.9.1` and test libs.
- **Android only.** Every JS entry point is a no-op when `Platform.OS !== 'android'` or the native module is missing (Expo Go, web, iOS). Contact sync must never break login, logout or any screen: JS calls into it swallow and `console.warn` errors.
- **No Android SDK or JDK on the dev machine.** Kotlin is compiled by EAS. The pure Kotlin core has a standalone runner (`modules/accel-contacts/scripts/test-core.sh`) that needs `brew install kotlin openjdk`; if those are not installed and the user has not agreed to install them, say so in the task report rather than claiming the tests passed.
- **Code style (JS):** 4-space indent, single quotes, JSX in `.js`, `StyleSheet.create` at the bottom, theme via `const { useTheme } = Theme; const { theme } = useTheme(); const { colors } = theme;`. Comments explain why. Colours are `colors.*` tokens only.
- **Tests:** `npx vitest run` must pass before every commit.
- **Commits:** one per task on branch `feat/android-contact-sync`, `type: summary` style, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Do not push.

## File map

```
modules/accel-contacts/
  expo-module.config.json                     Task 2
  index.js                                    Task 3
  app.plugin.js                               Task 3
  scripts/test-core.sh                        Task 1
  android/build.gradle                        Task 2
  android/src/main/AndroidManifest.xml        Task 2
  android/src/main/res/xml/authenticator.xml  Task 2
  android/src/main/res/xml/syncadapter.xml    Task 2
  android/src/main/res/xml/accel_data_extraction_rules.xml   Task 2
  android/src/main/res/drawable/accel_contacts_account.xml   Task 2
  android/src/main/res/values/accel_contacts_strings.xml     Task 2
  android/src/main/java/com/accelit/staffapp/contacts/
    DirectoryEntry.kt  DirectoryParser.kt  DirectoryDiff.kt  DeletionGuard.kt      Task 1 (pure)
    AccelAccount.kt  StubAuthenticator.kt  AuthenticatorService.kt  StubSyncService.kt
    SessionStore.kt  DirectoryClient.kt  ContactsStore.kt  ContactSyncWorker.kt
    SyncScheduler.kt  AccelContactsModule.kt                                        Task 2
  android/src/test/java/com/accelit/staffapp/contacts/
    DirectoryParserTest.kt  DirectoryDiffTest.kt  DeletionGuardTest.kt              Task 1
app.json                                      Task 3
.gitignore                                    Task 1
app/utils/contactSync.js                      Task 4
tests/contactSync.test.js                     Task 4
app/services/api.js, app/utils/authFlow.js, app/components/LogoutButton.js,
app/utils/useContactSyncRefresh.js, app/_layout.js,
tests/api.test.js, tests/rootLayout.test.js   Task 5
app/components/ContactSyncRow.js, app/(main)/address-book.js   Task 6
docs/contact-sync-verification.md             Task 7
```

Tasks run in order 1 → 7. Tasks 1–2 (Kotlin) and 3–4 (JS) are independent of each other and may run in parallel pairs; 5 needs 4; 6 needs 4; 7 is last.

---

### Task 1: Pure Kotlin core — entry, parser, diff, deletion guard

No `android.*` imports in these four files: they must compile with plain `kotlinc`.

**Files:**
- Create: `modules/accel-contacts/android/src/main/java/com/accelit/staffapp/contacts/DirectoryEntry.kt`
- Create: `.../contacts/DirectoryParser.kt`
- Create: `.../contacts/DirectoryDiff.kt`
- Create: `.../contacts/DeletionGuard.kt`
- Create: `modules/accel-contacts/android/src/test/java/com/accelit/staffapp/contacts/DirectoryParserTest.kt`
- Create: `.../contacts/DirectoryDiffTest.kt`
- Create: `.../contacts/DeletionGuardTest.kt`
- Create: `modules/accel-contacts/scripts/test-core.sh`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `data class DirectoryEntry(key: String, given: String?, family: String?, displayName: String, organization: String?, phones: List<String>, emails: List<String>)` with `val hash: String` and `companion fun sha256(text: String): String`
  - `object DirectoryParser { fun parse(body: String): List<DirectoryEntry>? }` — `null` means malformed
  - `data class LocalRow(rawContactId: Long, sourceId: String, hash: String)`
  - `data class ContactUpdate(rawContactId: Long, entry: DirectoryEntry)`
  - `data class DiffResult(creates: List<DirectoryEntry>, updates: List<ContactUpdate>, deletes: List<LocalRow>)`
  - `object DirectoryDiff { fun diff(server: List<DirectoryEntry>, local: List<LocalRow>): DiffResult }`
  - `object DeletionGuard { data class Decision(applyDeletes: Boolean, pendingFingerprint: String?); fun decide(localCount: Int, deleteSourceIds: List<String>, pending: String?): Decision }`

- [ ] **Step 1: Write the test runner script**

`modules/accel-contacts/scripts/test-core.sh` (then `chmod +x` it):

```bash
#!/usr/bin/env bash
# Compiles and runs the pure-Kotlin core tests without Gradle or an Android SDK.
# Needs: brew install kotlin openjdk
set -euo pipefail
cd "$(dirname "$0")/.."

command -v kotlinc >/dev/null || { echo "kotlinc not found: brew install kotlin openjdk" >&2; exit 2; }

LIB=.core-test/lib
OUT=.core-test/core-tests.jar
mkdir -p "$LIB"

fetch() { [ -f "$LIB/$2" ] || curl -fsSL "$1" -o "$LIB/$2"; }
M=https://repo1.maven.org/maven2
fetch $M/org/json/json/20240303/json-20240303.jar json.jar
fetch $M/junit/junit/4.13.2/junit-4.13.2.jar junit.jar
fetch $M/org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar hamcrest.jar

SRC=android/src/main/java/com/accelit/staffapp/contacts
TEST=android/src/test/java/com/accelit/staffapp/contacts
CP="$LIB/json.jar:$LIB/junit.jar:$LIB/hamcrest.jar"

kotlinc "$SRC/DirectoryEntry.kt" "$SRC/DirectoryParser.kt" "$SRC/DirectoryDiff.kt" "$SRC/DeletionGuard.kt" \
    "$TEST"/*.kt -cp "$CP" -include-runtime -d "$OUT" 2>&1 | grep -v '^warning:' || true

java -cp "$OUT:$CP" org.junit.runner.JUnitCore \
    com.accelit.staffapp.contacts.DirectoryParserTest \
    com.accelit.staffapp.contacts.DirectoryDiffTest \
    com.accelit.staffapp.contacts.DeletionGuardTest
```

Append to `.gitignore`:

```
# accel-contacts standalone Kotlin test build
modules/accel-contacts/.core-test/
```

- [ ] **Step 2: Write the failing tests**

`DirectoryParserTest.kt`:

```kotlin
package com.accelit.staffapp.contacts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DirectoryParserTest {
    private val pat = """{"type":"client_contact","displayname":"Pat Smith","contact_id":44,"client_id":12,"fname":"Pat","sname":"Smith","client_name":"Accolade Screens","email":"pat@accolade.com.au","phone":"+61400000001"}"""
    private val vendor = """{"type":"general_contact","displayname":"Vendor Support","contact_id":90,"client_id":null,"fname":"Vendor","sname":"Support","client_name":null,"email":"support@vendor.com","phone":null}"""
    private val client = """{"type":"client","displayname":"Accolade Screens","contact_id":null,"client_id":12,"fname":null,"sname":null,"client_name":"Accolade Screens","email":"info@accolade.com.au","phone":"+61733330000"}"""

    @Test fun mapsTheThreeRowTypes() {
        val entries = DirectoryParser.parse("[$pat,$vendor,$client]")!!

        assertEquals(listOf("contact:44", "contact:90", "client:12"), entries.map { it.key })

        val first = entries[0]
        assertEquals("Pat", first.given)
        assertEquals("Smith", first.family)
        assertEquals("Pat Smith", first.displayName)
        assertEquals("Accolade Screens", first.organization)
        assertEquals(listOf("+61400000001"), first.phones)
        assertEquals(listOf("pat@accolade.com.au"), first.emails)

        assertNull("general contacts carry no organisation", entries[1].organization)
        assertEquals(emptyList<String>(), entries[1].phones)
        assertNull("a client's name is already its display name", entries[2].organization)
        assertNull(entries[2].given)
    }

    @Test fun mergesRowsThatShareAKey() {
        val second = pat.replace("+61400000001", "+61400000002")
        val entries = DirectoryParser.parse("[$pat,$second,$pat]")!!

        assertEquals(1, entries.size)
        assertEquals(listOf("+61400000001", "+61400000002"), entries[0].phones)
        assertEquals(listOf("pat@accolade.com.au"), entries[0].emails)
    }

    @Test fun anEmptyArrayIsAValidEmptyDirectory() {
        assertEquals(emptyList<DirectoryEntry>(), DirectoryParser.parse("[]"))
    }

    @Test fun rejectsAnythingThatIsNotAFullyValidArray() {
        assertNull(DirectoryParser.parse(""))
        assertNull(DirectoryParser.parse("<html>login</html>"))
        assertNull(DirectoryParser.parse("""{"message":"Unauthenticated."}"""))
        assertNull("non-object row", DirectoryParser.parse("[$pat, 5]"))
        assertNull("unknown type", DirectoryParser.parse("""[{"type":"staff","contact_id":1,"displayname":"x","phone":"1"}]"""))
        assertNull("contact without contact_id", DirectoryParser.parse("""[{"type":"client_contact","contact_id":null,"client_id":3,"displayname":"x","phone":"1"}]"""))
        assertNull("client without client_id", DirectoryParser.parse("""[{"type":"client","client_id":null,"displayname":"x","phone":"1"}]"""))
        assertNull("one bad row poisons the lot", DirectoryParser.parse("[$pat,$vendor,{}]"))
    }

    @Test fun fallsBackWhenDisplaynameIsMissing() {
        val row = """{"type":"general_contact","contact_id":7,"displayname":null,"fname":" Ann ","sname":"Lee","email":"a@b.c","phone":null}"""
        assertEquals("Ann Lee", DirectoryParser.parse("[$row]")!![0].displayName)

        val bare = """{"type":"general_contact","contact_id":8,"displayname":"","fname":null,"sname":null,"email":"a@b.c","phone":null}"""
        assertEquals("a@b.c", DirectoryParser.parse("[$bare]")!![0].displayName)
    }

    @Test fun hashIsStableAndSensitive() {
        val a = DirectoryParser.parse("[$pat]")!![0]
        val b = DirectoryParser.parse("[$pat]")!![0]
        val moved = DirectoryParser.parse("[${pat.replace("+61400000001", "+61400000009")}]")!![0]

        assertEquals(a.hash, b.hash)
        assertEquals(64, a.hash.length)
        assertNotEquals(a.hash, moved.hash)
    }
}
```

`DirectoryDiffTest.kt`:

```kotlin
package com.accelit.staffapp.contacts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DirectoryDiffTest {
    private fun entry(key: String, phone: String = "1") =
        DirectoryEntry(key, null, null, key, null, listOf(phone), emptyList())

    private fun rowFor(id: Long, entry: DirectoryEntry) = LocalRow(id, entry.key, entry.hash)

    @Test fun emptyLocalCreatesEverything() {
        val server = listOf(entry("contact:1"), entry("client:2"))
        val result = DirectoryDiff.diff(server, emptyList())

        assertEquals(server, result.creates)
        assertTrue(result.updates.isEmpty() && result.deletes.isEmpty())
    }

    @Test fun unchangedDirectoryIsAnEmptyDiff() {
        val server = listOf(entry("contact:1"), entry("client:2"))
        val local = server.mapIndexed { i, e -> rowFor(i + 10L, e) }

        assertTrue(DirectoryDiff.diff(server, local).isEmpty)
    }

    @Test fun detectsCreateUpdateAndDelete() {
        val kept = entry("contact:1")
        val changedOld = entry("contact:2", phone = "old")
        val changedNew = entry("contact:2", phone = "new")
        val gone = entry("contact:3")
        val added = entry("contact:4")

        val result = DirectoryDiff.diff(
            listOf(kept, changedNew, added),
            listOf(rowFor(1, kept), rowFor(2, changedOld), rowFor(3, gone)),
        )

        assertEquals(listOf(added), result.creates)
        assertEquals(listOf(ContactUpdate(2, changedNew)), result.updates)
        assertEquals(listOf(rowFor(3, gone)), result.deletes)
    }

    @Test fun duplicateLocalSourceIdsKeepTheLowestRawId() {
        val e = entry("contact:1")
        val result = DirectoryDiff.diff(listOf(e), listOf(rowFor(9, e), rowFor(4, e)))

        assertEquals(listOf(rowFor(9, e)), result.deletes)
        assertTrue(result.creates.isEmpty() && result.updates.isEmpty())
    }

    @Test fun localRowsWithoutASourceIdAreDeleted() {
        val orphan = LocalRow(5, "", "")
        val result = DirectoryDiff.diff(emptyList(), listOf(orphan))

        assertEquals(listOf(orphan), result.deletes)
    }
}
```

`DeletionGuardTest.kt`:

```kotlin
package com.accelit.staffapp.contacts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DeletionGuardTest {
    private fun ids(n: Int) = (1..n).map { "contact:$it" }

    @Test fun ordinaryDeletesGoStraightThrough() {
        val decision = DeletionGuard.decide(localCount = 100, deleteSourceIds = ids(3), pending = null)

        assertTrue(decision.applyDeletes)
        assertNull(decision.pendingFingerprint)
    }

    @Test fun noDeletesIsNeverSuspectAndClearsPending() {
        assertEquals(DeletionGuard.Decision(true, null), DeletionGuard.decide(0, emptyList(), "stale"))
    }

    @Test fun wipingEverythingIsWithheldOnce() {
        val first = DeletionGuard.decide(5, ids(5), null)
        assertFalse(first.applyDeletes)
        assertNotNull(first.pendingFingerprint)

        val second = DeletionGuard.decide(5, ids(5), first.pendingFingerprint)
        assertTrue(second.applyDeletes)
        assertNull(second.pendingFingerprint)
    }

    @Test fun moreThanHalfOfALargeSetIsWithheld() {
        assertFalse(DeletionGuard.decide(20, ids(11), null).applyDeletes)
        assertTrue("exactly half is fine", DeletionGuard.decide(20, ids(10), null).applyDeletes)
        assertTrue("small sets only trip on a full wipe", DeletionGuard.decide(10, ids(9), null).applyDeletes)
    }

    @Test fun aDifferentDeleteSetRestartsTheWait() {
        val first = DeletionGuard.decide(20, ids(15), null)
        val second = DeletionGuard.decide(20, ids(16), first.pendingFingerprint)

        assertFalse(second.applyDeletes)
        assertTrue(second.pendingFingerprint != first.pendingFingerprint)
    }

    @Test fun fingerprintIgnoresOrder() {
        val a = DeletionGuard.decide(5, ids(5), null).pendingFingerprint
        val b = DeletionGuard.decide(5, ids(5).reversed(), null).pendingFingerprint

        assertEquals(a, b)
    }
}
```

- [ ] **Step 3: Run to verify failure**

Run: `modules/accel-contacts/scripts/test-core.sh`
Expected: compile errors, `unresolved reference: DirectoryParser` (the sources do not exist yet). If it exits 2 with "kotlinc not found", ask the user whether to `brew install kotlin openjdk`; if they decline, continue and record in the report that Kotlin tests were not run.

- [ ] **Step 4: Implement**

`DirectoryEntry.kt`:

```kotlin
package com.accelit.staffapp.contacts

import java.security.MessageDigest

// One person or company from the server directory, already normalised:
// phones and emails are trimmed, de-duplicated and sorted, so equal content
// always hashes equally.
data class DirectoryEntry(
    val key: String,
    val given: String?,
    val family: String?,
    val displayName: String,
    val organization: String?,
    val phones: List<String>,
    val emails: List<String>,
) {
    // Stored in RawContacts.SYNC1. A sync rewrites a raw contact only when
    // this differs, which is what keeps an unchanged directory write-free.
    val hash: String
        get() = sha256(
            listOf(
                SCHEMA, key, given.orEmpty(), family.orEmpty(), displayName, organization.orEmpty(),
                phones.joinToString(LIST_SEPARATOR), emails.joinToString(LIST_SEPARATOR),
            ).joinToString(FIELD_SEPARATOR),
        )

    companion object {
        // Bump when the entry -> Data row mapping changes, to force a rewrite.
        private const val SCHEMA = "v1"
        private const val FIELD_SEPARATOR = "\u001f"
        private const val LIST_SEPARATOR = "\u001e"

        fun sha256(text: String): String =
            MessageDigest.getInstance("SHA-256")
                .digest(text.toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
    }
}
```

`DirectoryParser.kt`:

```kotlin
package com.accelit.staffapp.contacts

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

// Turns the body of GET /api/address-book into entries. Returns null for
// anything short of a fully valid array: a partial directory must never be
// reconciled, because every row it is missing would read as a deletion.
object DirectoryParser {
    private val CONTACT_TYPES = setOf("client_contact", "general_contact")

    private class Builder(val type: String, row: JSONObject) {
        val given = text(row, "fname")
        val family = text(row, "sname")
        val displayName = text(row, "displayname")
        val clientName = text(row, "client_name")
        val phones = sortedSetOf<String>()
        val emails = sortedSetOf<String>()
    }

    fun parse(body: String): List<DirectoryEntry>? {
        val array = try {
            JSONArray(body)
        } catch (e: JSONException) {
            return null
        }

        val builders = LinkedHashMap<String, Builder>()

        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: return null
            val type = row.optString("type")

            val key = when (type) {
                in CONTACT_TYPES -> id(row, "contact_id")?.let { "contact:$it" }
                "client" -> id(row, "client_id")?.let { "client:$it" }
                else -> null
            } ?: return null

            // The API can repeat a person once per phone number. Names come
            // from the first row; numbers and addresses accumulate.
            val builder = builders.getOrPut(key) { Builder(type, row) }

            text(row, "phone")?.let { builder.phones.add(it) }
            text(row, "email")?.let { builder.emails.add(it) }
        }

        return builders.map { (key, b) ->
            val name = b.displayName
                ?: listOfNotNull(b.given, b.family).joinToString(" ").ifEmpty { null }
                ?: b.emails.firstOrNull()
                ?: b.phones.firstOrNull()
                ?: return null

            DirectoryEntry(
                key = key,
                given = b.given,
                family = b.family,
                displayName = name,
                organization = if (b.type == "client_contact") b.clientName else null,
                phones = b.phones.toList(),
                emails = b.emails.toList(),
            )
        }
    }

    private fun text(row: JSONObject, name: String): String? {
        if (row.isNull(name)) return null

        return row.optString(name).trim().ifEmpty { null }
    }

    private fun id(row: JSONObject, name: String): Long? {
        if (row.isNull(name)) return null

        val value = when (val raw = row.opt(name)) {
            is Number -> raw.toLong()
            is String -> raw.trim().toLongOrNull()
            else -> null
        }

        return value?.takeIf { it > 0 }
    }
}
```

`DirectoryDiff.kt`:

```kotlin
package com.accelit.staffapp.contacts

// One of OUR raw contacts as the provider currently holds it.
data class LocalRow(val rawContactId: Long, val sourceId: String, val hash: String)

data class ContactUpdate(val rawContactId: Long, val entry: DirectoryEntry)

data class DiffResult(
    val creates: List<DirectoryEntry>,
    val updates: List<ContactUpdate>,
    val deletes: List<LocalRow>,
) {
    val isEmpty: Boolean get() = creates.isEmpty() && updates.isEmpty() && deletes.isEmpty()
}

// Identity is the server key held in SOURCE_ID. Names, numbers and Android's
// aggregate contact id play no part.
object DirectoryDiff {
    fun diff(server: List<DirectoryEntry>, local: List<LocalRow>): DiffResult {
        val kept = HashMap<String, LocalRow>()
        val deletes = ArrayList<LocalRow>()

        // A half-applied batch or a provider quirk could leave two rows for one
        // key. Keep the oldest, drop the rest, and the next run is clean again.
        for (row in local.sortedBy { it.rawContactId }) {
            if (row.sourceId.isEmpty() || kept.containsKey(row.sourceId)) deletes.add(row)
            else kept[row.sourceId] = row
        }

        val creates = ArrayList<DirectoryEntry>()
        val updates = ArrayList<ContactUpdate>()
        val serverKeys = HashSet<String>()

        for (entry in server) {
            serverKeys.add(entry.key)

            val row = kept[entry.key]

            if (row == null) creates.add(entry)
            else if (row.hash != entry.hash) updates.add(ContactUpdate(row.rawContactId, entry))
        }

        kept.values
            .filter { it.sourceId !in serverKeys }
            .sortedBy { it.rawContactId }
            .forEach { deletes.add(it) }

        return DiffResult(creates, updates, deletes)
    }
}
```

`DeletionGuard.kt`:

```kotlin
package com.accelit.staffapp.contacts

// A 200 with an empty or gutted array is far more likely to be a server-side
// accident than the whole company leaving. Such a deletion is only believed
// when two syncs in a row ask for exactly the same one.
object DeletionGuard {
    private const val LARGE_SET = 20

    data class Decision(val applyDeletes: Boolean, val pendingFingerprint: String?)

    fun decide(localCount: Int, deleteSourceIds: List<String>, pending: String?): Decision {
        if (!isSuspect(localCount, deleteSourceIds.size)) return Decision(true, null)

        val fingerprint = DirectoryEntry.sha256(deleteSourceIds.sorted().joinToString("\n"))

        return if (fingerprint == pending) Decision(true, null) else Decision(false, fingerprint)
    }

    private fun isSuspect(localCount: Int, deleteCount: Int): Boolean {
        if (deleteCount == 0) return false
        if (deleteCount >= localCount) return true

        return localCount >= LARGE_SET && deleteCount * 2 > localCount
    }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `modules/accel-contacts/scripts/test-core.sh`
Expected: `OK (18 tests)`.

- [ ] **Step 6: Commit**

```bash
git add .gitignore modules/accel-contacts
git commit -m "feat: pure Kotlin core for contact sync — parse, diff, deletion guard

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Android layer — account, provider writer, worker, Expo module

Nothing here can be compiled locally. Write it exactly, then check it by reading: every symbol used must be defined in Task 1's Interfaces or in this task.

**Files (all under `modules/accel-contacts/`):**
- Create: `expo-module.config.json`, `android/build.gradle`, `android/src/main/AndroidManifest.xml`
- Create: `android/src/main/res/xml/authenticator.xml`, `res/xml/syncadapter.xml`, `res/xml/accel_data_extraction_rules.xml`, `res/drawable/accel_contacts_account.xml`, `res/values/accel_contacts_strings.xml`
- Create in `android/src/main/java/com/accelit/staffapp/contacts/`: `AccelAccount.kt`, `StubAuthenticator.kt`, `AuthenticatorService.kt`, `StubSyncService.kt`, `SessionStore.kt`, `DirectoryClient.kt`, `ContactsStore.kt`, `SyncScheduler.kt`, `ContactSyncWorker.kt`, `AccelContactsModule.kt`

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces: native module `AccelContacts` with async functions
  `setSession(token: String, baseUrl: String)`, `clearSession()`, `enable()` (rejects with code `ERR_CONTACTS_PERMISSION` when permissions are missing), `disable()`, `syncNow()`, `getStatus(): { enabled: Boolean, hasPermission: Boolean, accountExists: Boolean, lastSuccessAt: Double?, lastError: String? }`.
  `lastError` is one of `permission | auth | http | network | malformed | provider | null`.

- [ ] **Step 1: Module scaffold**

`expo-module.config.json`:

```json
{
  "platforms": ["android"],
  "android": {
    "modules": ["com.accelit.staffapp.contacts.AccelContactsModule"]
  }
}
```

`android/build.gradle`:

```gradle
plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

group = 'com.accelit.staffapp.contacts'
version = '1.0.0'

android {
  namespace "com.accelit.staffapp.contacts"
  defaultConfig {
    versionCode 1
    versionName '1.0.0'
  }
}

dependencies {
  implementation "androidx.core:core-ktx:1.13.1"
  implementation "androidx.work:work-runtime-ktx:2.9.1"
  implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3"

  // android.jar stubs org.json out in local unit tests; the parser needs the real thing.
  testImplementation "junit:junit:4.13.2"
  testImplementation "org.json:json:20240303"
}
```

`android/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  <uses-permission android:name="android.permission.READ_CONTACTS" />
  <uses-permission android:name="android.permission.WRITE_CONTACTS" />

  <application>
    <!-- Owns the account type. The system binds to this; when the app is
         uninstalled the authenticator disappears and Android removes the
         account, which makes the Contacts Provider purge its raw contacts. -->
    <service
      android:name=".AuthenticatorService"
      android:exported="true">
      <intent-filter>
        <action android:name="android.accounts.AccountAuthenticator" />
      </intent-filter>
      <meta-data
        android:name="android.accounts.AccountAuthenticator"
        android:resource="@xml/authenticator" />
    </service>

    <!-- Declared so Contacts apps know the account's contacts are read-only
         (supportsUploading=false). It is never syncable and never runs;
         WorkManager does the real work. -->
    <service
      android:name=".StubSyncService"
      android:exported="true">
      <intent-filter>
        <action android:name="android.content.SyncAdapter" />
      </intent-filter>
      <meta-data
        android:name="android.content.SyncAdapter"
        android:resource="@xml/syncadapter" />
    </service>
  </application>
</manifest>
```

`res/xml/authenticator.xml`:

```xml
<account-authenticator xmlns:android="http://schemas.android.com/apk/res/android"
  android:accountType="com.accelit.staffapp"
  android:icon="@drawable/accel_contacts_account"
  android:smallIcon="@drawable/accel_contacts_account"
  android:label="@string/accel_contacts_account_label" />
```

`res/xml/syncadapter.xml`:

```xml
<sync-adapter xmlns:android="http://schemas.android.com/apk/res/android"
  android:contentAuthority="com.android.contacts"
  android:accountType="com.accelit.staffapp"
  android:userVisible="false"
  android:supportsUploading="false"
  android:allowParallelSyncs="false"
  android:isAlwaysSyncable="false" />
```

`res/xml/accel_data_extraction_rules.xml`:

```xml
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
  </cloud-backup>
  <device-transfer>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
  </device-transfer>
</data-extraction-rules>
```

`res/drawable/accel_contacts_account.xml` (the library cannot reference the app's launcher icon, so it ships its own):

```xml
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="48dp" android:height="48dp"
  android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#4B8FC8"
    android:pathData="M12,2a10,10 0,1 0,0 20a10,10 0,1 0,0 -20z" />
  <path android:fillColor="#FFFFFF"
    android:pathData="M12,6.5a3,3 0,1 0,0 6a3,3 0,1 0,0 -6zM12,14c-2.7,0 -5,1.3 -5.8,3.2a7.5,7.5 0,0 0,11.6 0C17,15.3 14.7,14 12,14z" />
</vector>
```

`res/values/accel_contacts_strings.xml`:

```xml
<resources>
  <string name="accel_contacts_account_label">Accel Staff</string>
</resources>
```

- [ ] **Step 2: Account and stubs**

`AccelAccount.kt`:

```kotlin
package com.accelit.staffapp.contacts

import android.accounts.Account
import android.accounts.AccountManager
import android.content.ContentResolver
import android.content.Context

// The account exists to own raw contacts. It has no password and
// authenticates against nothing.
object AccelAccount {
    const val TYPE = "com.accelit.staffapp"
    const val NAME = "Accel Staff"
    private const val CONTACTS_AUTHORITY = "com.android.contacts"

    val account: Account get() = Account(NAME, TYPE)

    fun exists(context: Context): Boolean =
        AccountManager.get(context).getAccountsByType(TYPE).any { it.name == NAME }

    fun ensure(context: Context) {
        if (!exists(context)) AccountManager.get(context).addAccountExplicitly(account, null, null)

        // The declared sync adapter must never be scheduled by the framework.
        ContentResolver.setIsSyncable(account, CONTACTS_AUTHORITY, 0)
        ContentResolver.setSyncAutomatically(account, CONTACTS_AUTHORITY, false)
    }

    // The Contacts Provider deletes an account's raw contacts when the
    // account goes, so this is also how the local directory is wiped.
    fun remove(context: Context) {
        if (exists(context)) AccountManager.get(context).removeAccountExplicitly(account)
    }
}
```

`StubAuthenticator.kt`:

```kotlin
package com.accelit.staffapp.contacts

import android.accounts.AbstractAccountAuthenticator
import android.accounts.Account
import android.accounts.AccountAuthenticatorResponse
import android.accounts.AccountManager
import android.content.Context
import android.os.Bundle

class StubAuthenticator(context: Context) : AbstractAccountAuthenticator(context) {
    // "Add account" in system Settings lands here. The account is only ever
    // created by the app's own toggle, so this refuses.
    override fun addAccount(
        response: AccountAuthenticatorResponse?, accountType: String?, authTokenType: String?,
        requiredFeatures: Array<out String>?, options: Bundle?,
    ): Bundle = Bundle().apply {
        putInt(AccountManager.KEY_ERROR_CODE, AccountManager.ERROR_CODE_UNSUPPORTED_OPERATION)
        putString(AccountManager.KEY_ERROR_MESSAGE, "Turn this on from the Address Book in Accel Staff.")
    }

    override fun editProperties(response: AccountAuthenticatorResponse?, accountType: String?): Bundle? = null

    override fun confirmCredentials(response: AccountAuthenticatorResponse?, account: Account?, options: Bundle?): Bundle? = null

    override fun getAuthToken(response: AccountAuthenticatorResponse?, account: Account?, authTokenType: String?, options: Bundle?): Bundle? = null

    override fun getAuthTokenLabel(authTokenType: String?): String? = null

    override fun updateCredentials(response: AccountAuthenticatorResponse?, account: Account?, authTokenType: String?, options: Bundle?): Bundle? = null

    override fun hasFeatures(response: AccountAuthenticatorResponse?, account: Account?, features: Array<out String>?): Bundle =
        Bundle().apply { putBoolean(AccountManager.KEY_BOOLEAN_RESULT, false) }
}
```

`AuthenticatorService.kt`:

```kotlin
package com.accelit.staffapp.contacts

import android.app.Service
import android.content.Intent
import android.os.IBinder

class AuthenticatorService : Service() {
    private lateinit var authenticator: StubAuthenticator

    override fun onCreate() {
        authenticator = StubAuthenticator(this)
    }

    override fun onBind(intent: Intent?): IBinder = authenticator.iBinder
}
```

`StubSyncService.kt`:

```kotlin
package com.accelit.staffapp.contacts

import android.accounts.Account
import android.app.Service
import android.content.AbstractThreadedSyncAdapter
import android.content.ContentProviderClient
import android.content.Context
import android.content.Intent
import android.content.SyncResult
import android.os.Bundle
import android.os.IBinder

// Exists only for its manifest declaration. It uploads nothing and, because
// the account is never syncable, the framework never calls it.
class StubSyncService : Service() {
    private class Adapter(context: Context) : AbstractThreadedSyncAdapter(context, false) {
        override fun onPerformSync(
            account: Account?, extras: Bundle?, authority: String?,
            provider: ContentProviderClient?, syncResult: SyncResult?,
        ) = Unit
    }

    private lateinit var adapter: Adapter

    override fun onCreate() {
        adapter = Adapter(applicationContext)
    }

    override fun onBind(intent: Intent?): IBinder = adapter.syncAdapterBinder
}
```

- [ ] **Step 3: Session store and HTTP client**

`SessionStore.kt`:

```kotlin
package com.accelit.staffapp.contacts

import android.content.Context

// Everything the worker needs while JS is not running. Holds no contact data.
// The file is excluded from backup and device transfer by the extraction rules.
class SessionStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("accel_contacts", Context.MODE_PRIVATE)

    val token: String? get() = prefs.getString(TOKEN, null)
    val baseUrl: String? get() = prefs.getString(BASE_URL, null)

    var enabled: Boolean
        get() = prefs.getBoolean(ENABLED, false)
        set(value) = prefs.edit().putBoolean(ENABLED, value).apply()

    var pendingDeleteFingerprint: String?
        get() = prefs.getString(PENDING_DELETE, null)
        set(value) = prefs.edit().putString(PENDING_DELETE, value).apply()

    val lastSuccessAt: Long? get() = prefs.getLong(LAST_SUCCESS, 0L).takeIf { it > 0 }
    val lastError: String? get() = prefs.getString(LAST_ERROR, null)

    fun setSession(token: String, baseUrl: String) =
        prefs.edit().putString(TOKEN, token).putString(BASE_URL, baseUrl).apply()

    fun clearSession() = prefs.edit().remove(TOKEN).apply()

    fun recordSuccess(now: Long) =
        prefs.edit().putLong(LAST_SUCCESS, now).remove(LAST_ERROR).apply()

    fun recordError(kind: String) = prefs.edit().putString(LAST_ERROR, kind).apply()

    // Turning the feature off forgets sync history so the next enable starts clean.
    fun resetSyncState() =
        prefs.edit().remove(LAST_SUCCESS).remove(LAST_ERROR).remove(PENDING_DELETE).apply()

    private companion object {
        const val TOKEN = "token"
        const val BASE_URL = "baseUrl"
        const val ENABLED = "enabled"
        const val LAST_SUCCESS = "lastSuccessAt"
        const val LAST_ERROR = "lastError"
        const val PENDING_DELETE = "pendingDeleteFingerprint"
    }
}
```

`DirectoryClient.kt`:

```kotlin
package com.accelit.staffapp.contacts

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

sealed class FetchResult {
    data class Ok(val entries: List<DirectoryEntry>) : FetchResult()
    data class Failure(val kind: String) : FetchResult()
}

object DirectoryClient {
    private const val TIMEOUT_MS = 30_000

    // Only a 200 carrying a fully valid array is a directory. Everything else
    // is a Failure, and a Failure never reaches the Contacts Provider.
    fun fetch(baseUrl: String, token: String): FetchResult {
        var connection: HttpURLConnection? = null

        return try {
            connection = (URL("${baseUrl.trimEnd('/')}/api/address-book").openConnection() as HttpURLConnection).apply {
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
                // A redirect to a login page must not be followed into a 200.
                instanceFollowRedirects = false
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
            }

            when (val status = connection.responseCode) {
                200 -> {
                    val body = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }

                    DirectoryParser.parse(body)?.let { FetchResult.Ok(it) } ?: FetchResult.Failure("malformed")
                }
                401 -> FetchResult.Failure("auth")
                else -> FetchResult.Failure("http").also { android.util.Log.w("AccelContacts", "address-book answered $status") }
            }
        } catch (e: IOException) {
            FetchResult.Failure("network")
        } catch (e: Exception) {
            android.util.Log.w("AccelContacts", "address-book fetch failed", e)
            FetchResult.Failure("malformed")
        } finally {
            connection?.disconnect()
        }
    }
}
```

- [ ] **Step 4: ContactsStore — the only ContactsContract user**

`ContactsStore.kt`:

```kotlin
package com.accelit.staffapp.contacts

import android.content.ContentProviderOperation
import android.content.ContentResolver
import android.content.ContentValues
import android.net.Uri
import android.provider.ContactsContract
import android.provider.ContactsContract.CommonDataKinds.Email
import android.provider.ContactsContract.CommonDataKinds.Organization
import android.provider.ContactsContract.CommonDataKinds.Phone
import android.provider.ContactsContract.CommonDataKinds.StructuredName
import android.provider.ContactsContract.Data
import android.provider.ContactsContract.RawContacts

// The single place that talks to the Contacts Provider. It has no method that
// takes a caller-supplied selection or URI: every statement below is pinned to
// our own account, so another account's raw contact cannot be reached from
// here even when Android shows it merged with one of ours.
class ContactsStore(private val resolver: ContentResolver) {
    private val ownedArgs = arrayOf(AccelAccount.TYPE, AccelAccount.NAME)

    // CALLER_IS_SYNCADAPTER makes a delete a real delete (not a DELETED=1
    // tombstone waiting for a sync adapter that will never come) and stops
    // the provider marking rows dirty.
    private fun scoped(uri: Uri): Uri = uri.buildUpon()
        .appendQueryParameter(ContactsContract.CALLER_IS_SYNCADAPTER, "true")
        .appendQueryParameter(RawContacts.ACCOUNT_NAME, AccelAccount.NAME)
        .appendQueryParameter(RawContacts.ACCOUNT_TYPE, AccelAccount.TYPE)
        .build()

    private val rawUri = scoped(RawContacts.CONTENT_URI)
    private val dataUri = scoped(Data.CONTENT_URI)
    private val settingsUri = scoped(ContactsContract.Settings.CONTENT_URI)

    // Contacts that belong to no group are hidden for an account unless it says
    // otherwise. Ours never use groups.
    fun ensureVisible() {
        val values = ContentValues().apply {
            put(ContactsContract.Settings.ACCOUNT_NAME, AccelAccount.NAME)
            put(ContactsContract.Settings.ACCOUNT_TYPE, AccelAccount.TYPE)
            put(ContactsContract.Settings.UNGROUPED_VISIBLE, 1)
        }

        val exists = resolver.query(
            settingsUri, arrayOf(ContactsContract.Settings.UNGROUPED_VISIBLE), OWNED, ownedArgs, null,
        )?.use { it.count > 0 } ?: false

        if (exists) resolver.update(settingsUri, values, OWNED, ownedArgs)
        else resolver.insert(settingsUri, values)
    }

    fun listOwned(): List<LocalRow> {
        val rows = ArrayList<LocalRow>()

        resolver.query(
            rawUri,
            arrayOf(RawContacts._ID, RawContacts.SOURCE_ID, RawContacts.SYNC1),
            "$OWNED AND ${RawContacts.DELETED}=0",
            ownedArgs,
            null,
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                rows.add(LocalRow(cursor.getLong(0), cursor.getString(1).orEmpty(), cursor.getString(2).orEmpty()))
            }
        } ?: throw IllegalStateException("Contacts Provider returned no cursor")

        return rows
    }

    fun apply(creates: List<DirectoryEntry>, updates: List<ContactUpdate>, deletes: List<LocalRow>) {
        val batch = ArrayList<ContentProviderOperation>()

        // Back-references are positions inside one batch, so a raw contact and
        // its data rows must never straddle two batches.
        fun add(size: Int, build: (start: Int) -> List<ContentProviderOperation>) {
            if (batch.isNotEmpty() && batch.size + size > MAX_BATCH) flush(batch)

            batch.addAll(build(batch.size))
        }

        creates.forEach { entry ->
            val data = dataValues(entry)

            add(1 + data.size) { start ->
                listOf(
                    ContentProviderOperation.newInsert(rawUri)
                        .withValue(RawContacts.ACCOUNT_TYPE, AccelAccount.TYPE)
                        .withValue(RawContacts.ACCOUNT_NAME, AccelAccount.NAME)
                        .withValue(RawContacts.SOURCE_ID, entry.key)
                        .withValue(RawContacts.SYNC1, entry.hash)
                        .withYieldAllowed(true)
                        .build(),
                ) + data.map {
                    ContentProviderOperation.newInsert(dataUri)
                        .withValueBackReference(Data.RAW_CONTACT_ID, start)
                        .withValues(it)
                        .build()
                }
            }
        }

        updates.forEach { update ->
            val id = update.rawContactId.toString()
            val data = dataValues(update.entry)

            // update.rawContactId came out of listOwned(), which is scoped to
            // our account; the final statement re-checks ownership regardless.
            add(2 + data.size) {
                listOf(
                    ContentProviderOperation.newDelete(dataUri)
                        .withSelection("${Data.RAW_CONTACT_ID}=?", arrayOf(id))
                        .withYieldAllowed(true)
                        .build(),
                ) + data.map {
                    ContentProviderOperation.newInsert(dataUri)
                        .withValue(Data.RAW_CONTACT_ID, update.rawContactId)
                        .withValues(it)
                        .build()
                } + ContentProviderOperation.newUpdate(rawUri)
                    .withSelection("${RawContacts._ID}=? AND $OWNED", arrayOf(id) + ownedArgs)
                    .withValue(RawContacts.SYNC1, update.entry.hash)
                    .build()
            }
        }

        deletes.forEach { row ->
            add(1) {
                listOf(
                    ContentProviderOperation.newDelete(rawUri)
                        .withSelection("${RawContacts._ID}=? AND $OWNED", arrayOf(row.rawContactId.toString()) + ownedArgs)
                        .withYieldAllowed(true)
                        .build(),
                )
            }
        }

        flush(batch)
    }

    private fun flush(batch: ArrayList<ContentProviderOperation>) {
        if (batch.isEmpty()) return

        resolver.applyBatch(ContactsContract.AUTHORITY, batch)
        batch.clear()
    }

    private fun dataValues(entry: DirectoryEntry): List<ContentValues> {
        val rows = ArrayList<ContentValues>()

        rows.add(ContentValues().apply {
            put(Data.MIMETYPE, StructuredName.CONTENT_ITEM_TYPE)
            put(StructuredName.DISPLAY_NAME, entry.displayName)
            entry.given?.let { put(StructuredName.GIVEN_NAME, it) }
            entry.family?.let { put(StructuredName.FAMILY_NAME, it) }
        })

        entry.phones.forEach { number ->
            rows.add(ContentValues().apply {
                put(Data.MIMETYPE, Phone.CONTENT_ITEM_TYPE)
                put(Phone.NUMBER, number)
                put(Phone.TYPE, Phone.TYPE_WORK)
            })
        }

        entry.emails.forEach { address ->
            rows.add(ContentValues().apply {
                put(Data.MIMETYPE, Email.CONTENT_ITEM_TYPE)
                put(Email.ADDRESS, address)
                put(Email.TYPE, Email.TYPE_WORK)
            })
        }

        entry.organization?.let { company ->
            rows.add(ContentValues().apply {
                put(Data.MIMETYPE, Organization.CONTENT_ITEM_TYPE)
                put(Organization.COMPANY, company)
                put(Organization.TYPE, Organization.TYPE_WORK)
            })
        }

        return rows
    }

    private companion object {
        const val OWNED = "${RawContacts.ACCOUNT_TYPE}=? AND ${RawContacts.ACCOUNT_NAME}=?"
        const val MAX_BATCH = 400
    }
}
```

- [ ] **Step 5: Scheduler and worker**

`SyncScheduler.kt`:

```kotlin
package com.accelit.staffapp.contacts

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object SyncScheduler {
    const val PERIODIC = "accel-contact-sync"
    const val ONE_OFF = "accel-contact-sync-now"

    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    // KEEP: enabling twice, or on every launch, still leaves exactly one hourly
    // job. WorkManager decides the real timing; nothing here uses exact alarms.
    fun schedulePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<ContactSyncWorker>(1, TimeUnit.HOURS)
            .setConstraints(online)
            .build()

        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun syncNow(context: Context) {
        val request = OneTimeWorkRequestBuilder<ContactSyncWorker>()
            .setConstraints(online)
            .addTag(ONE_OFF)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(ONE_OFF, ExistingWorkPolicy.KEEP, request)
    }

    fun cancelAll(context: Context) {
        WorkManager.getInstance(context).apply {
            cancelUniqueWork(PERIODIC)
            cancelUniqueWork(ONE_OFF)
        }
    }
}
```

`ContactSyncWorker.kt`:

```kotlin
package com.accelit.staffapp.contacts

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

class ContactSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = lock.withLock {
        withContext(Dispatchers.IO) { sync() }
    }

    private fun sync(): Result {
        val context = applicationContext
        val session = SessionStore(context)

        if (!session.enabled) return Result.success()

        if (!hasContactsPermission(context)) {
            // Retrying cannot grant a permission; the toggle shows this state.
            session.recordError("permission")

            return Result.success()
        }

        if (!AccelAccount.exists(context)) {
            // The user removed the account in system Settings, which already
            // took the contacts with it. Treat that as switching the feature off.
            session.enabled = false
            session.resetSyncState()
            SyncScheduler.cancelAll(context)

            return Result.success()
        }

        val token = session.token
        val baseUrl = session.baseUrl

        if (token == null || baseUrl == null) return fail(session, "auth")

        val entries = when (val fetched = DirectoryClient.fetch(baseUrl, token)) {
            is FetchResult.Failure -> return fail(session, fetched.kind)
            is FetchResult.Ok -> fetched.entries
        }

        return try {
            val store = ContactsStore(context.contentResolver)
            val local = store.listOwned()
            val diff = DirectoryDiff.diff(entries, local)

            val guard = DeletionGuard.decide(local.size, diff.deletes.map { it.sourceId }, session.pendingDeleteFingerprint)
            val deletes = if (guard.applyDeletes) diff.deletes else emptyList()

            if (guard.pendingFingerprint != session.pendingDeleteFingerprint) {
                session.pendingDeleteFingerprint = guard.pendingFingerprint
            }

            // An unchanged directory ends here without a single provider write.
            if (diff.creates.isNotEmpty() || diff.updates.isNotEmpty() || deletes.isNotEmpty()) {
                store.apply(diff.creates, diff.updates, deletes)
            }

            session.recordSuccess(System.currentTimeMillis())

            Result.success()
        } catch (e: Exception) {
            Log.w("AccelContacts", "contact reconcile failed", e)

            fail(session, "provider")
        }
    }

    // The hourly job retries with WorkManager's backoff. A one-off run just
    // fails: the hourly job is its retry, and a dead token must not leave a
    // one-off job backing off forever.
    private fun fail(session: SessionStore, kind: String): Result {
        session.recordError(kind)

        return if (tags.contains(SyncScheduler.ONE_OFF)) Result.failure() else Result.retry()
    }

    companion object {
        // The hourly and one-off jobs are different unique works, so
        // WorkManager could run them side by side.
        private val lock = Mutex()

        fun hasContactsPermission(context: Context): Boolean =
            listOf(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS).all {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }
    }
}
```

- [ ] **Step 6: Expo module**

`AccelContactsModule.kt`:

```kotlin
package com.accelit.staffapp.contacts

import android.content.Context
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AccelContactsModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

    override fun definition() = ModuleDefinition {
        Name("AccelContacts")

        AsyncFunction("setSession") { token: String, baseUrl: String ->
            SessionStore(context).setSession(token, baseUrl)
        }

        AsyncFunction("clearSession") {
            SessionStore(context).clearSession()
        }

        AsyncFunction("enable") {
            if (!ContactSyncWorker.hasContactsPermission(context)) {
                throw CodedException("ERR_CONTACTS_PERMISSION", "Contacts permission has not been granted.", null)
            }

            AccelAccount.ensure(context)
            ContactsStore(context.contentResolver).ensureVisible()
            SessionStore(context).enabled = true
            SyncScheduler.schedulePeriodic(context)
            SyncScheduler.syncNow(context)
        }

        AsyncFunction("disable") {
            SyncScheduler.cancelAll(context)

            SessionStore(context).apply {
                enabled = false
                resetSyncState()
            }

            AccelAccount.remove(context)
        }

        AsyncFunction("syncNow") {
            if (SessionStore(context).enabled) SyncScheduler.syncNow(context)
        }

        AsyncFunction("getStatus") {
            val session = SessionStore(context)

            mapOf(
                "enabled" to session.enabled,
                "hasPermission" to ContactSyncWorker.hasContactsPermission(context),
                "accountExists" to AccelAccount.exists(context),
                "lastSuccessAt" to session.lastSuccessAt?.toDouble(),
                "lastError" to session.lastError,
            )
        }
    }
}
```

- [ ] **Step 7: Self-check by reading**

Nothing compiles locally, so verify by inspection and record the result in the task report:
- `grep -rn "ContactsContract" modules/accel-contacts/android/src/main/java` → only `ContactsStore.kt`.
- `grep -rn "CONTACT_ID" modules/accel-contacts/android/src/main/java` → only `Data.RAW_CONTACT_ID` occurrences.
- Every `resolver.query/update/delete` and every `newUpdate/newDelete` on `rawUri` has `OWNED` in its selection.
- `modules/accel-contacts/scripts/test-core.sh` still passes (it must not pick up any Task 2 file).

- [ ] **Step 8: Commit**

```bash
git add modules/accel-contacts
git commit -m "feat: Android account, contacts writer and hourly sync worker

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: JS module API, config plugin, app.json

**Files:**
- Create: `modules/accel-contacts/index.js`
- Create: `modules/accel-contacts/app.plugin.js`
- Create: `tests/accelContactsModule.test.js`
- Modify: `app.json`

**Interfaces:**
- Consumes: native module `AccelContacts` (Task 2) — by name only; this task does not need Task 2 to exist to pass its tests.
- Produces: default export of `modules/accel-contacts/index.js`:
  `isSupported(): boolean`, `setSession(token, baseUrl): Promise<void>`, `clearSession(): Promise<void>`, `enable(): Promise<void>`, `disable(): Promise<void>`, `syncNow(): Promise<void>`, `getStatus(): Promise<Status>`; named export `OFF_STATUS = { enabled: false, hasPermission: false, accountExists: false, lastSuccessAt: null, lastError: null }`.

- [ ] **Step 1: Write the failing test**

`tests/accelContactsModule.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The module is loaded fresh per test because it reads Platform.OS and looks
// the native module up once, at import time.
const load = async ({ os, native }) => {
    vi.resetModules();
    vi.doMock('react-native', () => ({ Platform: { OS: os } }));
    vi.doMock('expo', () => ({ requireOptionalNativeModule: vi.fn(() => native) }));

    return import('../modules/accel-contacts');
};

beforeEach(() => { vi.restoreAllMocks(); });

describe('accel-contacts JS API', () => {
    it('is inert off Android', async () => {
        const native = { enable: vi.fn() };
        const { default: contacts, OFF_STATUS } = await load({ os: 'ios', native });

        expect(contacts.isSupported()).toBe(false);
        await expect(contacts.enable()).resolves.toBeUndefined();
        await expect(contacts.getStatus()).resolves.toEqual(OFF_STATUS);
        expect(native.enable).not.toHaveBeenCalled();
    });

    it('is inert on Android when the native module is missing (Expo Go)', async () => {
        const { default: contacts, OFF_STATUS } = await load({ os: 'android', native: null });

        expect(contacts.isSupported()).toBe(false);
        await expect(contacts.syncNow()).resolves.toBeUndefined();
        await expect(contacts.getStatus()).resolves.toEqual(OFF_STATUS);
    });

    it('delegates to the native module on Android', async () => {
        const status = { enabled: true, hasPermission: true, accountExists: true, lastSuccessAt: 5, lastError: null };
        const native = {
            setSession: vi.fn(async () => {}),
            clearSession: vi.fn(async () => {}),
            enable: vi.fn(async () => {}),
            disable: vi.fn(async () => {}),
            syncNow: vi.fn(async () => {}),
            getStatus: vi.fn(async () => status),
        };
        const { default: contacts } = await load({ os: 'android', native });

        expect(contacts.isSupported()).toBe(true);

        await contacts.setSession('tok', 'https://x');
        await contacts.clearSession();
        await contacts.enable();
        await contacts.disable();
        await contacts.syncNow();

        expect(native.setSession).toHaveBeenCalledWith('tok', 'https://x');
        expect(native.clearSession).toHaveBeenCalled();
        expect(native.enable).toHaveBeenCalled();
        expect(native.disable).toHaveBeenCalled();
        expect(native.syncNow).toHaveBeenCalled();
        await expect(contacts.getStatus()).resolves.toEqual(status);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/accelContactsModule.test.js`
Expected: FAIL — cannot resolve `../modules/accel-contacts`.

- [ ] **Step 3: Implement**

`modules/accel-contacts/index.js`:

```js
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// Android only, and only in a build that contains the native module. In Expo
// Go, on iOS and on web every call below resolves without doing anything, so
// callers never need a platform check of their own.
const native = Platform.OS === 'android' ? requireOptionalNativeModule('AccelContacts') : null;

export const OFF_STATUS = {
    enabled: false,
    hasPermission: false,
    accountExists: false,
    lastSuccessAt: null,
    lastError: null,
};

export default {
    isSupported: () => !!native,
    setSession: async (token, baseUrl) => { if (native) await native.setSession(token, baseUrl); },
    clearSession: async () => { if (native) await native.clearSession(); },
    enable: async () => { if (native) await native.enable(); },
    disable: async () => { if (native) await native.disable(); },
    syncNow: async () => { if (native) await native.syncNow(); },
    getStatus: async () => (native ? native.getStatus() : OFF_STATUS),
};
```

`modules/accel-contacts/app.plugin.js`:

```js
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

// The directory is a projection of the server, never something to restore:
// keep every byte of app data out of cloud backup and device-to-device
// transfer. The rules file itself ships in the module's res/xml.
module.exports = function withAccelContacts(config) {
    return withAndroidManifest(config, (cfg) => {
        const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);

        application.$['android:allowBackup'] = 'false';
        application.$['android:dataExtractionRules'] = '@xml/accel_data_extraction_rules';
        delete application.$['android:fullBackupContent'];

        return cfg;
    });
};
```

`app.json` — inside `expo.android` add `"allowBackup": false`, and append the plugin last so it wins over anything earlier:

```json
    "android": {
      "package": "com.accelit.staffapp",
      "allowBackup": false,
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon.png",
        "backgroundColor": "#4b8fc8"
      }
    },
```

```json
    "plugins": [
      "expo-router",
      "expo-font",
      "./modules/accel-contacts/app.plugin.js"
    ],
```

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/accelContactsModule.test.js` → 3 passed.

Run: `npx expo config --type introspect 2>/dev/null | grep -n "allowBackup\|dataExtractionRules\|fullBackupContent"`
Expected: `'android:allowBackup': 'false'` and `'android:dataExtractionRules': '@xml/accel_data_extraction_rules'`, and no `fullBackupContent` line.

Run: `npx expo-modules-autolinking resolve --platform android 2>/dev/null | grep -n "accel-contacts\|AccelContactsModule"`
Expected: at least one match (needs Task 2's `expo-module.config.json`; if Task 2 has not landed yet, note that and re-run after it has).

Run: `npx vitest run` → all files pass.

- [ ] **Step 5: Commit**

```bash
git add modules/accel-contacts/index.js modules/accel-contacts/app.plugin.js tests/accelContactsModule.test.js app.json
git commit -m "feat: JS API and config plugin for the contacts module; backup off

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `contactSync.js` — the app-facing wrapper

**Files:**
- Create: `app/utils/contactSync.js`
- Create: `tests/contactSync.test.js`

**Interfaces:**
- Consumes: default export and `OFF_STATUS` of `modules/accel-contacts/index.js` (Task 3).
- Produces (named exports):
  - `STALE_MS = 3600000`
  - `isSupported(): boolean`
  - `getStatus(): Promise<Status>` — never rejects
  - `turnOn(): Promise<{ ok: true } | { ok: false, reason: 'unsupported' | 'denied' | 'blocked' | 'error' }>`
  - `turnOff(): Promise<void>` — never rejects
  - `requestSync(): Promise<void>` — never rejects
  - `refreshIfStale(now = Date.now()): Promise<boolean>` — true when a sync was requested
  - `onSessionStarted(token, baseUrl): Promise<void>` — never rejects
  - `onSessionEnded({ explicit }): Promise<void>` — never rejects; `explicit: true` also removes the account
  - `errorText(lastError): string | null`

- [ ] **Step 1: Write the failing test**

`tests/contactSync.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    supported: true,
    status: null,
    permissions: {},
    native: {},
}));

vi.mock('react-native', () => ({
    PermissionsAndroid: {
        PERMISSIONS: { READ_CONTACTS: 'read', WRITE_CONTACTS: 'write' },
        RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' },
        requestMultiple: vi.fn(async () => mocks.permissions),
    },
}));

vi.mock('../modules/accel-contacts', () => {
    const OFF_STATUS = { enabled: false, hasPermission: false, accountExists: false, lastSuccessAt: null, lastError: null };

    mocks.native = {
        isSupported: vi.fn(() => mocks.supported),
        setSession: vi.fn(async () => {}),
        clearSession: vi.fn(async () => {}),
        enable: vi.fn(async () => {}),
        disable: vi.fn(async () => {}),
        syncNow: vi.fn(async () => {}),
        getStatus: vi.fn(async () => mocks.status ?? OFF_STATUS),
    };

    return { default: mocks.native, OFF_STATUS };
});

import {
    STALE_MS, turnOn, turnOff, refreshIfStale, requestSync, getStatus,
    onSessionStarted, onSessionEnded, errorText,
} from '../app/utils/contactSync';

const NOW = 1_800_000_000_000;
const enabled = (extra = {}) => ({
    enabled: true, hasPermission: true, accountExists: true, lastSuccessAt: NOW, lastError: null, ...extra,
});

beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.supported = true;
    mocks.status = null;
    mocks.permissions = { read: 'granted', write: 'granted' };
    await onSessionEnded({ explicit: false });
    vi.clearAllMocks();
});

describe('turnOn', () => {
    it('enables once both permissions are granted', async () => {
        await expect(turnOn()).resolves.toEqual({ ok: true });
        expect(mocks.native.enable).toHaveBeenCalledTimes(1);
    });

    it('stays off when a permission is denied', async () => {
        mocks.permissions = { read: 'granted', write: 'denied' };

        await expect(turnOn()).resolves.toEqual({ ok: false, reason: 'denied' });
        expect(mocks.native.enable).not.toHaveBeenCalled();
    });

    it('reports blocked when Android will not ask again', async () => {
        mocks.permissions = { read: 'never_ask_again', write: 'never_ask_again' };

        await expect(turnOn()).resolves.toEqual({ ok: false, reason: 'blocked' });
    });

    it('does nothing where the module is absent', async () => {
        mocks.supported = false;

        await expect(turnOn()).resolves.toEqual({ ok: false, reason: 'unsupported' });
    });

    it('turns a native failure into a result, not a throw', async () => {
        mocks.native.enable.mockRejectedValueOnce(new Error('boom'));

        await expect(turnOn()).resolves.toEqual({ ok: false, reason: 'error' });
    });
});

describe('refreshIfStale', () => {
    it('does nothing while the feature is off', async () => {
        await expect(refreshIfStale(NOW)).resolves.toBe(false);
        expect(mocks.native.syncNow).not.toHaveBeenCalled();
    });

    it('does nothing inside the hour', async () => {
        mocks.status = enabled({ lastSuccessAt: NOW - STALE_MS + 1 });

        await expect(refreshIfStale(NOW)).resolves.toBe(false);
    });

    it('syncs once the last success is an hour old', async () => {
        mocks.status = enabled({ lastSuccessAt: NOW - STALE_MS });

        await expect(refreshIfStale(NOW)).resolves.toBe(true);
        expect(mocks.native.syncNow).toHaveBeenCalledTimes(1);
    });

    it('syncs when the directory has never been populated', async () => {
        mocks.status = enabled({ lastSuccessAt: null });

        await expect(refreshIfStale(NOW)).resolves.toBe(true);
    });

    it('syncs when the last attempt failed, however recent the last success', async () => {
        mocks.status = enabled({ lastError: 'auth' });

        await expect(refreshIfStale(NOW)).resolves.toBe(true);
    });
});

describe('session wiring', () => {
    it('hands the token to native once per token', async () => {
        await onSessionStarted('tok', 'https://api');
        await onSessionStarted('tok', 'https://api');

        expect(mocks.native.setSession).toHaveBeenCalledTimes(1);
        expect(mocks.native.setSession).toHaveBeenCalledWith('tok', 'https://api');

        await onSessionStarted('tok-2', 'https://api');
        expect(mocks.native.setSession).toHaveBeenCalledTimes(2);
    });

    it('populates an enabled but empty directory right after login', async () => {
        mocks.status = enabled({ lastSuccessAt: null });

        await onSessionStarted('tok', 'https://api');

        expect(mocks.native.syncNow).toHaveBeenCalledTimes(1);
    });

    it('an expired session forgets the token but keeps the contacts', async () => {
        await onSessionEnded({ explicit: false });

        expect(mocks.native.clearSession).toHaveBeenCalledTimes(1);
        expect(mocks.native.disable).not.toHaveBeenCalled();
    });

    it('signing out removes the account and the contacts with it', async () => {
        await onSessionEnded({ explicit: true });

        expect(mocks.native.disable).toHaveBeenCalledTimes(1);
        expect(mocks.native.clearSession).toHaveBeenCalledTimes(1);
    });

    it('never lets a native failure escape into the auth flow', async () => {
        mocks.native.setSession.mockRejectedValueOnce(new Error('boom'));
        mocks.native.disable.mockRejectedValueOnce(new Error('boom'));
        mocks.native.getStatus.mockRejectedValueOnce(new Error('boom'));

        await expect(onSessionStarted('tok', 'https://api')).resolves.toBeUndefined();
        await expect(onSessionEnded({ explicit: true })).resolves.toBeUndefined();
        await expect(getStatus()).resolves.toMatchObject({ enabled: false });
        expect(mocks.native.clearSession).toHaveBeenCalled();
    });
});

describe('small things', () => {
    it('turnOff and requestSync delegate', async () => {
        await turnOff();
        await requestSync();

        expect(mocks.native.disable).toHaveBeenCalledTimes(1);
        expect(mocks.native.syncNow).toHaveBeenCalledTimes(1);
    });

    it('explains each failure in plain words', () => {
        expect(errorText(null)).toBeNull();
        expect(errorText('auth')).toBe('Sign in again to keep contacts up to date.');
        expect(errorText('permission')).toBe('Contacts permission was turned off.');
        expect(errorText('network')).toBe('Could not reach the server. Will retry.');
        expect(errorText('http')).toBe('Could not reach the server. Will retry.');
        expect(errorText('malformed')).toBe('Last sync failed. Will retry.');
        expect(errorText('provider')).toBe('Last sync failed. Will retry.');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/contactSync.test.js`
Expected: FAIL — cannot resolve `../app/utils/contactSync`.

- [ ] **Step 3: Implement**

`app/utils/contactSync.js`:

```js
import { PermissionsAndroid } from 'react-native';
import contacts, { OFF_STATUS } from '../../modules/accel-contacts';

// Device-contact integration is a convenience. Nothing in here is allowed to
// break login, logout or a screen, so every call into native is contained.
export const STALE_MS = 60 * 60 * 1000;

const ERROR_TEXT = {
    permission: 'Contacts permission was turned off.',
    auth: 'Sign in again to keep contacts up to date.',
    network: 'Could not reach the server. Will retry.',
    http: 'Could not reach the server. Will retry.',
    malformed: 'Last sync failed. Will retry.',
    provider: 'Last sync failed. Will retry.',
};

// restore() runs on every navigation; native only needs telling when the
// token actually changes.
let pushedToken = null;

async function quietly(label, work) {
    try {
        return await work();
    } catch (error) {
        console.warn(`contact sync: ${label} failed`, error);

        return undefined;
    }
}

export const isSupported = () => contacts.isSupported();

export const errorText = (lastError) => (lastError ? ERROR_TEXT[lastError] || ERROR_TEXT.provider : null);

export async function getStatus() {
    return (await quietly('status', () => contacts.getStatus())) ?? OFF_STATUS;
}

export async function turnOn() {
    if (!contacts.isSupported()) return { ok: false, reason: 'unsupported' };

    const { PERMISSIONS, RESULTS } = PermissionsAndroid;
    const wanted = [PERMISSIONS.READ_CONTACTS, PERMISSIONS.WRITE_CONTACTS];

    try {
        const answers = await PermissionsAndroid.requestMultiple(wanted);
        const results = wanted.map((permission) => answers[permission]);

        if (results.some((result) => result === RESULTS.NEVER_ASK_AGAIN)) return { ok: false, reason: 'blocked' };
        if (results.some((result) => result !== RESULTS.GRANTED)) return { ok: false, reason: 'denied' };

        await contacts.enable();

        return { ok: true };
    } catch (error) {
        console.warn('contact sync: enable failed', error);

        return { ok: false, reason: 'error' };
    }
}

export async function turnOff() {
    await quietly('disable', () => contacts.disable());
}

export async function requestSync() {
    await quietly('sync', () => contacts.syncNow());
}

export async function refreshIfStale(now = Date.now()) {
    const status = await getStatus();

    if (!status.enabled) return false;

    const fresh = status.lastSuccessAt && now - status.lastSuccessAt < STALE_MS;

    if (fresh && !status.lastError) return false;

    await requestSync();

    return true;
}

export async function onSessionStarted(token, baseUrl) {
    if (!contacts.isSupported() || !token || token === pushedToken) return;

    const pushed = await quietly('session', async () => {
        await contacts.setSession(token, baseUrl);

        return true;
    });

    if (!pushed) return;

    pushedToken = token;
    await refreshIfStale();
}

// explicit: the user signed out, so the directory leaves the phone with them.
// Otherwise the session merely expired: the worker loses its token, the
// contacts stay, and the next login picks the sync back up.
export async function onSessionEnded({ explicit = false } = {}) {
    pushedToken = null;

    if (explicit) await quietly('disable', () => contacts.disable());

    await quietly('clear session', () => contacts.clearSession());
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/contactSync.test.js` → 17 passed. Then `npx vitest run` → all files pass.

- [ ] **Step 5: Commit**

```bash
git add app/utils/contactSync.js tests/contactSync.test.js
git commit -m "feat: contactSync wrapper — permissions, staleness, session hand-off

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Wire the session and lifecycle triggers

**Files:**
- Modify: `app/services/api.js` (the `API_BASE_URL` const near line 7, `restore()`, the 401 branch of `handleFailure`)
- Modify: `app/utils/authFlow.js` (`persistAuth`, `clearAuth`)
- Modify: `app/components/LogoutButton.js` (`logout` callback)
- Create: `app/utils/useContactSyncRefresh.js`
- Modify: `app/_layout.js` (`RootLayoutInner`)
- Modify: `tests/api.test.js`, `tests/rootLayout.test.js`
- Create: `tests/useContactSyncRefresh.test.js`

**Interfaces:**
- Consumes: `onSessionStarted(token, baseUrl)`, `onSessionEnded({ explicit })`, `refreshIfStale()` from `app/utils/contactSync.js` (Task 4).
- Produces: named export `API_BASE_URL` from `app/services/api.js`; default export `useContactSyncRefresh(active: boolean)`.

- [ ] **Step 1: Write the failing tests**

In `tests/api.test.js`, add below the existing `vi.mock('expo-router', ...)` line:

```js
const sync = vi.hoisted(() => ({ onSessionStarted: vi.fn(async () => {}), onSessionEnded: vi.fn(async () => {}) }));

vi.mock('../app/utils/contactSync', () => sync);
```

Change the api import to `import api, { API_BASE_URL } from '../app/services/api';`, add `afterEach` to the vitest import, add `sync.onSessionStarted.mockClear(); sync.onSessionEnded.mockClear();` to the existing `beforeEach`, and append:

```js
afterEach(() => { vi.unstubAllGlobals(); });

describe('contact sync hand-off', () => {
    it('gives a restored token to the contact sync', async () => {
        store.data.set(STORAGE_KEYS.token, 'full-token');

        await api.restore();

        expect(sync.onSessionStarted).toHaveBeenCalledWith('full-token', API_BASE_URL);
    });

    it('does not hand over anything when no token is stored', async () => {
        await api.restore();

        expect(sync.onSessionStarted).not.toHaveBeenCalled();
    });

    it('a 401 ends the native session but is not an explicit sign-out', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: false, status: 401, text: async () => '{"message":"Unauthenticated."}',
        })));
        api.setToken('dead-token');

        await expect(api.me()).rejects.toMatchObject({ status: 401 });

        expect(sync.onSessionEnded).toHaveBeenCalledWith({ explicit: false });
    });
});
```

`tests/useContactSyncRefresh.test.js`:

```js
/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ listener: null, remove: vi.fn(), refreshIfStale: vi.fn(async () => false) }));

vi.mock('react-native', () => ({
    AppState: {
        addEventListener: (event, listener) => {
            mocks.listener = listener;

            return { remove: mocks.remove };
        },
    },
}));

vi.mock('../app/utils/contactSync', () => ({ refreshIfStale: mocks.refreshIfStale }));

import useContactSyncRefresh from '../app/utils/useContactSyncRefresh';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ active }) {
    useContactSyncRefresh(active);

    return null;
}

const render = async (root, active) => act(async () => { root.render(<Probe active={active} />); });

beforeEach(() => {
    mocks.listener = null;
    mocks.remove.mockClear();
    mocks.refreshIfStale.mockClear();
});

describe('useContactSyncRefresh', () => {
    it('stays silent until the user is signed in', async () => {
        const root = createRoot(document.createElement('div'));

        await render(root, false);

        expect(mocks.refreshIfStale).not.toHaveBeenCalled();
        expect(mocks.listener).toBeNull();
    });

    it('checks on sign-in and again each time the app comes forward', async () => {
        const root = createRoot(document.createElement('div'));

        await render(root, true);
        expect(mocks.refreshIfStale).toHaveBeenCalledTimes(1);

        mocks.listener('background');
        expect(mocks.refreshIfStale).toHaveBeenCalledTimes(1);

        mocks.listener('active');
        expect(mocks.refreshIfStale).toHaveBeenCalledTimes(2);

        await act(async () => { root.unmount(); });
        expect(mocks.remove).toHaveBeenCalledTimes(1);
    });
});
```

In `tests/rootLayout.test.js`, add next to the other `vi.mock` calls (the layout test is about routing, and its `react-native` mock has no `AppState`):

```js
vi.mock('../app/utils/useContactSyncRefresh', () => ({ default: () => {} }));
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/api.test.js tests/useContactSyncRefresh.test.js`
Expected: FAIL — `API_BASE_URL` undefined / `onSessionStarted` not called / cannot resolve `useContactSyncRefresh`.

- [ ] **Step 3: Implement**

`app/services/api.js`:

```js
import { onSessionStarted, onSessionEnded } from '../utils/contactSync';
```

```js
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://app.accelit.online';
```

In `restore()` replace `if (token) this.setToken(token);` with:

```js
        if (token) {
            this.setToken(token);
            // The hourly contact worker runs without JS and needs its own copy.
            await onSessionStarted(token, API_BASE_URL);
        }
```

In `handleFailure`, inside the 401 branch, after `this.setToken(null);`:

```js
            // Expired, not signed out: the worker loses its token, the phone
            // keeps the contacts it already has.
            await onSessionEnded({ explicit: false });
```

`app/utils/authFlow.js`:

```js
import api, { API_BASE_URL } from '../services/api';
import { onSessionStarted, onSessionEnded } from './contactSync';
```

`persistAuth` — after `api.setToken(token);` add `await onSessionStarted(token, API_BASE_URL);`.
`clearAuth` — after `api.setDeviceToken(null);` add `await onSessionEnded({ explicit: false });`.

`app/components/LogoutButton.js` — import `{ onSessionEnded } from '../utils/contactSync'` and, immediately before `await clearAuth();`:

```js
        // Signing out takes the staff directory off the phone as well.
        await onSessionEnded({ explicit: true });
```

`app/utils/useContactSyncRefresh.js`:

```js
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { refreshIfStale } from './contactSync';

// WorkManager keeps the directory roughly hourly in the background. Coming to
// the foreground is the cheap moment to catch up if Android deferred it.
export default function useContactSyncRefresh(active) {
    useEffect(() => {
        if (!active) return undefined;

        refreshIfStale();

        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') refreshIfStale();
        });

        return () => subscription.remove();
    }, [active]);
}
```

`app/_layout.js` — import it, and call it in `RootLayoutInner` directly after the `navigationTheme` `useMemo` and **before** the `if (isChecking)` early return (hooks must not sit behind a return):

```js
import useContactSyncRefresh from './utils/useContactSyncRefresh';
```

```js
    useContactSyncRefresh(authenticated && !inAuthGroup);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run` → all files pass (api: +3, useContactSyncRefresh: 2).
If any other existing test now fails while importing `expo` or `react-native` through `app/utils/contactSync`, it reaches `LogoutButton`/`authFlow`/`api` unmocked: add `vi.mock('../app/utils/contactSync', () => ({ onSessionStarted: async () => {}, onSessionEnded: async () => {}, refreshIfStale: async () => false }));` to that test file rather than changing app code. (At the time of writing, `onboardingScreens.test.js` and `rootLayout.test.js` mock `services/api` wholesale and do not import `StaffInfo`/`LogoutButton`, so none should.)
Run: `npx esbuild --loader:.js=jsx --log-level=warning app/_layout.js app/components/LogoutButton.js app/utils/authFlow.js --outdir=/tmp/esb >/dev/null` → no output.

- [ ] **Step 5: Commit**

```bash
git add app/services/api.js app/utils/authFlow.js app/components/LogoutButton.js app/utils/useContactSyncRefresh.js app/_layout.js tests/api.test.js tests/rootLayout.test.js tests/useContactSyncRefresh.test.js
git commit -m "feat: hand the session to contact sync; refresh on login and foreground

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Address Book toggle

**Files:**
- Create: `app/components/ContactSyncRow.js`
- Create: `tests/contactSyncRow.test.js`
- Modify: `app/(main)/address-book.js`

**Interfaces:**
- Consumes: `isSupported`, `getStatus`, `turnOn`, `turnOff`, `requestSync`, `errorText` from `app/utils/contactSync.js`; `moment` (already a dependency).
- Produces: `<ContactSyncRow refreshKey={number} />` — renders nothing where unsupported.

- [ ] **Step 1: Write the failing test**

`tests/contactSyncRow.test.js`:

```js
/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const OFF = { enabled: false, hasPermission: false, accountExists: false, lastSuccessAt: null, lastError: null };

const mocks = vi.hoisted(() => ({
    supported: true,
    status: null,
    turnOn: vi.fn(),
    turnOff: vi.fn(async () => {}),
    openSettings: vi.fn(),
}));

vi.mock('react-native', async () => {
    const R = await import('react');
    const el = (tag, map = () => ({})) => ({ children, ...props }) => R.createElement(tag, map(props), children);

    return {
        View: el('div'),
        Text: el('span'),
        TouchableOpacity: el('button', (p) => ({ onClick: p.onPress })),
        Switch: ({ value, onValueChange, disabled }) => R.createElement('input', {
            type: 'checkbox', checked: !!value, disabled, onChange: (e) => onValueChange(e.target.checked),
        }),
        Linking: { openSettings: mocks.openSettings },
        StyleSheet: { create: (s) => s },
    };
});

vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

vi.mock('../app/context/ThemeContext', () => ({
    default: {
        useTheme: () => ({
            theme: { colors: { surface: '#fff', border: '#ddd', primary: '#00f', textPrimary: '#000', textSecondary: '#666', error: '#f00' } },
        }),
    },
}));

vi.mock('../app/utils/contactSync', () => ({
    isSupported: () => mocks.supported,
    getStatus: async () => mocks.status,
    turnOn: mocks.turnOn,
    turnOff: mocks.turnOff,
    errorText: (kind) => (kind ? `error:${kind}` : null),
}));

import ContactSyncRow from '../app/components/ContactSyncRow';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host;

const mount = async () => {
    host = document.createElement('div');
    document.body.appendChild(host);

    await act(async () => { createRoot(host).render(<ContactSyncRow refreshKey={0} />); });
};

const toggle = async () => act(async () => { host.querySelector('input').click(); });

beforeEach(() => {
    mocks.supported = true;
    mocks.status = { ...OFF };
    mocks.turnOn.mockReset();
    mocks.turnOff.mockClear();
    mocks.openSettings.mockClear();
});

describe('ContactSyncRow', () => {
    it('renders nothing where contact sync is unsupported', async () => {
        mocks.supported = false;
        await mount();

        expect(host.textContent).toBe('');
    });

    it('starts off and explains itself', async () => {
        await mount();

        expect(host.querySelector('input').checked).toBe(false);
        expect(host.textContent).toContain('Show in phone contacts');
        expect(host.textContent).toContain('Adds the directory to caller ID on this phone.');
    });

    it('turns on when permission is granted', async () => {
        mocks.turnOn.mockImplementation(async () => {
            mocks.status = { ...OFF, enabled: true, hasPermission: true, accountExists: true };

            return { ok: true };
        });
        await mount();
        await toggle();

        expect(host.querySelector('input').checked).toBe(true);
        expect(host.textContent).toContain('Syncing…');
    });

    it('stays off and says why when permission is denied', async () => {
        mocks.turnOn.mockResolvedValue({ ok: false, reason: 'denied' });
        await mount();
        await toggle();

        expect(host.querySelector('input').checked).toBe(false);
        expect(host.textContent).toContain('Contacts permission is needed to show the directory in your phone.');
    });

    it('offers system settings when Android will not ask again', async () => {
        mocks.turnOn.mockResolvedValue({ ok: false, reason: 'blocked' });
        await mount();
        await toggle();

        await act(async () => { host.querySelector('button').click(); });

        expect(mocks.openSettings).toHaveBeenCalledTimes(1);
    });

    it('turns off', async () => {
        mocks.status = { ...OFF, enabled: true, hasPermission: true, accountExists: true, lastSuccessAt: Date.now() };
        mocks.turnOff.mockImplementation(async () => { mocks.status = { ...OFF }; });
        await mount();

        expect(host.textContent).toContain('Synced');

        await toggle();

        expect(mocks.turnOff).toHaveBeenCalledTimes(1);
        expect(host.querySelector('input').checked).toBe(false);
    });

    it('shows the last sync error', async () => {
        mocks.status = { ...OFF, enabled: true, hasPermission: true, accountExists: true, lastError: 'auth' };
        await mount();

        expect(host.textContent).toContain('error:auth');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/contactSyncRow.test.js`
Expected: FAIL — cannot resolve `../app/components/ContactSyncRow`.

- [ ] **Step 3: Implement the row**

`app/components/ContactSyncRow.js`:

```js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import Theme from '../context/ThemeContext';
import { isSupported, getStatus, turnOn, turnOff, errorText } from '../utils/contactSync';

const NOTES = {
    denied: 'Contacts permission is needed to show the directory in your phone.',
    blocked: 'Contacts permission is blocked. Tap to open settings.',
    error: 'Could not turn this on. Try again.',
};

// Android only. Puts the staff directory into the phone's own contacts, under
// an account this app owns, so callers are named even when the app is closed.
export default function ContactSyncRow({ refreshKey }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const supported = isSupported();

    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState(null);

    const reload = useCallback(async () => { setStatus(await getStatus()); }, []);

    useEffect(() => {
        if (supported) reload();
    }, [supported, reload, refreshKey]);

    // The first sync is queued, not awaited. Look again shortly so "Syncing…"
    // becomes "Synced" without the user having to pull to refresh.
    useEffect(() => {
        if (!status?.enabled || status.lastSuccessAt || status.lastError) return undefined;

        const timer = setTimeout(reload, 5000);

        return () => clearTimeout(timer);
    }, [status, reload]);

    const onToggle = useCallback(async (next) => {
        setBusy(true);
        setProblem(null);

        if (next) {
            const result = await turnOn();

            if (!result.ok) setProblem(result.reason);
        } else {
            await turnOff();
        }

        await reload();
        setBusy(false);
    }, [reload]);

    if (!supported || !status) return null;

    const on = status.enabled && status.accountExists;

    let caption = 'Adds the directory to caller ID on this phone.';

    if (problem) caption = NOTES[problem] || NOTES.error;
    else if (on && status.lastError) caption = errorText(status.lastError);
    else if (on && status.lastSuccessAt) caption = `Synced ${moment(status.lastSuccessAt).fromNow()}`;
    else if (on) caption = 'Syncing…';

    const warn = !!problem || (on && !!status.lastError);

    const captionNode = (
        <Text style={[styles.caption, { color: warn ? colors.error : colors.textSecondary }]}>{caption}</Text>
    );

    return (
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="call-outline" size={17} color={colors.primary} />

            <View style={styles.text}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    Show in phone contacts
                </Text>

                {problem === 'blocked' ? (
                    <TouchableOpacity onPress={() => Linking.openSettings()} accessibilityRole="button">
                        {captionNode}
                    </TouchableOpacity>
                ) : captionNode}
            </View>

            <Switch
                value={on}
                onValueChange={onToggle}
                disabled={busy}
                trackColor={{ true: colors.primary }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        borderWidth: 1, borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 8, marginTop: 10,
    },
    text: { flex: 1 },
    title: { fontSize: 14, fontWeight: '600' },
    caption: { fontSize: 12, marginTop: 1 },
});
```

- [ ] **Step 4: Put it on the screen**

`app/(main)/address-book.js`:

Imports:

```js
import ContactSyncRow from '../components/ContactSyncRow';
import { requestSync } from '../utils/contactSync';
```

State, next to `sheetPerson`:

```js
    const [syncTick, setSyncTick] = useState(0);
```

In `load`, make an explicit refresh also refresh the phone's copy — replace the first line of `load`'s body:

```js
        if (refresh) {
            setRefreshing(true);
            // Pulling to refresh is the user asking for fresh contacts, on the
            // phone as much as on this screen. A no-op while the toggle is off.
            requestSync().then(() => setSyncTick((tick) => tick + 1));
        } else {
            setLoading(true);
        }
```

Render it under the search field:

```js
            <View style={styles.controls}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Name, company, number" />
                <ContactSyncRow refreshKey={syncTick} />
            </View>
```

- [ ] **Step 5: Verify**

Run: `npx vitest run` → all files pass (contactSyncRow: 7).
Run: `npx esbuild --loader:.js=jsx --log-level=warning "app/(main)/address-book.js" app/components/ContactSyncRow.js --outdir=/tmp/esb >/dev/null` → no output.
Run the web build per the project memory (expo web on :8081) and confirm the Address Book still renders and shows **no** toggle on web.

- [ ] **Step 6: Commit**

```bash
git add app/components/ContactSyncRow.js tests/contactSyncRow.test.js "app/(main)/address-book.js"
git commit -m "feat: Address Book switch to show the directory in phone contacts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Device verification checklist

The acceptance criteria are mostly observable only on a phone. This task writes the script for that; it does not run it.

**Files:**
- Create: `docs/contact-sync-verification.md`

**Interfaces:** none.

- [ ] **Step 1: Write the checklist**

`docs/contact-sync-verification.md`:

````markdown
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
````

- [ ] **Step 2: Final check**

Run: `npx vitest run` → all pass. Run `modules/accel-contacts/scripts/test-core.sh` if kotlinc is available.
Run: `git status --short` → clean apart from this file.

- [ ] **Step 3: Commit**

```bash
git add docs/contact-sync-verification.md
git commit -m "docs: device verification checklist for contact sync

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Report to the user: the feature is code-complete but **uncompiled** until an EAS Android build runs; give them the build command and point them at the checklist. Do not start an EAS build yourself.
