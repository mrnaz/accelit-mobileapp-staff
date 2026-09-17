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
