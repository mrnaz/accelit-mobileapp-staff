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
