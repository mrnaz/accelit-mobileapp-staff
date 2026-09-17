package com.accelit.staffapp.contacts

import android.accounts.Account
import android.accounts.AccountManager
import android.content.ContentResolver
import android.content.Context
import expo.modules.kotlin.exception.CodedException

// The account exists to own raw contacts. It has no password and
// authenticates against nothing.
object AccelAccount {
    const val TYPE = "com.accelit.staffapp"
    const val NAME = "Accel Staff"
    private const val CONTACTS_AUTHORITY = "com.android.contacts"

    val account: Account get() = Account(NAME, TYPE)

    fun exists(context: Context): Boolean =
        AccountManager.get(context).getAccountsByType(TYPE).any { it.name == NAME }

    // Returns whether this call created the account (false when it already
    // existed), so a caller that needs to undo its own work on later failure
    // knows whether removing the account is its responsibility.
    fun ensure(context: Context): Boolean {
        val created = !exists(context)

        if (created) {
            val added = AccountManager.get(context).addAccountExplicitly(account, null, null)

            // False means no account was left behind: there is nothing to
            // reconcile against, so the caller must not proceed as if enabling
            // succeeded.
            if (!added) {
                throw CodedException("ERR_CONTACTS_ACCOUNT", "The Accel Staff account could not be created.", null)
            }
        }

        // The declared sync adapter must never be scheduled by the framework.
        ContentResolver.setIsSyncable(account, CONTACTS_AUTHORITY, 0)
        ContentResolver.setSyncAutomatically(account, CONTACTS_AUTHORITY, false)

        return created
    }

    // The Contacts Provider deletes an account's raw contacts when the
    // account goes, so this is also how the local directory is wiped.
    fun remove(context: Context) {
        if (exists(context)) AccountManager.get(context).removeAccountExplicitly(account)
    }
}
