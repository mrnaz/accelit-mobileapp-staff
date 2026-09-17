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
