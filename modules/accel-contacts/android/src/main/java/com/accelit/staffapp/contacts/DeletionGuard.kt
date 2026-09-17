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
