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
