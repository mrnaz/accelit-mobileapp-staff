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
