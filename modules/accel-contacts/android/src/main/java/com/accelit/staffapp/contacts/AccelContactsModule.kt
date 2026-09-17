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
