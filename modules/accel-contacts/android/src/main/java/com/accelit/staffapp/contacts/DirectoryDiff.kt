package com.accelit.staffapp.contacts

// One of OUR raw contacts as the provider currently holds it.
data class LocalRow(val rawContactId: Long, val sourceId: String, val hash: String)

data class ContactUpdate(val rawContactId: Long, val entry: DirectoryEntry)

data class DiffResult(
    val creates: List<DirectoryEntry>,
    val updates: List<ContactUpdate>,
    val deletes: List<LocalRow>,
) {
    val isEmpty: Boolean get() = creates.isEmpty() && updates.isEmpty() && deletes.isEmpty()
}

// Identity is the server key held in SOURCE_ID. Names, numbers and Android's
// aggregate contact id play no part.
object DirectoryDiff {
    fun diff(server: List<DirectoryEntry>, local: List<LocalRow>): DiffResult {
        val kept = HashMap<String, LocalRow>()
        val deletes = ArrayList<LocalRow>()

        // A half-applied batch or a provider quirk could leave two rows for one
        // key. Keep the oldest, drop the rest, and the next run is clean again.
        for (row in local.sortedBy { it.rawContactId }) {
            if (row.sourceId.isEmpty() || kept.containsKey(row.sourceId)) deletes.add(row)
            else kept[row.sourceId] = row
        }

        val creates = ArrayList<DirectoryEntry>()
        val updates = ArrayList<ContactUpdate>()
        val serverKeys = HashSet<String>()

        for (entry in server) {
            serverKeys.add(entry.key)

            val row = kept[entry.key]

            if (row == null) creates.add(entry)
            else if (row.hash != entry.hash) updates.add(ContactUpdate(row.rawContactId, entry))
        }

        kept.values
            .filter { it.sourceId !in serverKeys }
            .sortedBy { it.rawContactId }
            .forEach { deletes.add(it) }

        return DiffResult(creates, updates, deletes)
    }
}
