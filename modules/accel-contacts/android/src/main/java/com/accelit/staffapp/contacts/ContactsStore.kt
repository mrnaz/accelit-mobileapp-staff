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
