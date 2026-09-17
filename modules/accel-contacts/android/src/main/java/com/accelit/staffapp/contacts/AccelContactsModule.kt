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

            val createdAccount = AccelAccount.ensure(context)

            try {
                ContactsStore(context.contentResolver).ensureVisible()
                // Clears any status left over from a previous enable/disable
                // cycle, so re-enabling after the account was removed
                // externally cannot show a stale success over an empty
                // directory.
                SessionStore(context).resetSyncState()
                SessionStore(context).enabled = true
                SyncScheduler.schedulePeriodic(context)
                SyncScheduler.syncNow(context)
            } catch (e: Exception) {
                // Enabling is all-or-nothing: a failure here must not leave an
                // orphaned system account behind a feature that reads as off,
                // but an account that pre-dated this call is not ours to remove.
                // The switch is turned off first, and each remaining cleanup
                // step is isolated in its own try/catch, so a step that throws
                // can neither skip the others nor replace the original
                // exception below.
                SessionStore(context).enabled = false

                try {
                    SyncScheduler.cancelAll(context)
                } catch (cancelError: Exception) {
                    android.util.Log.w("AccelContacts", "enable() rollback: cancelAll failed", cancelError)
                }

                if (createdAccount) {
                    try {
                        AccelAccount.remove(context)
                    } catch (removeError: Exception) {
                        android.util.Log.w("AccelContacts", "enable() rollback: account remove failed", removeError)
                    }
                }

                throw e
            }
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
