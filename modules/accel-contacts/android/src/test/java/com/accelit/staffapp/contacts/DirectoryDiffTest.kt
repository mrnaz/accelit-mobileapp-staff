package com.accelit.staffapp.contacts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DirectoryDiffTest {
    private fun entry(key: String, phone: String = "1") =
        DirectoryEntry(key, null, null, key, null, listOf(phone), emptyList())

    private fun rowFor(id: Long, entry: DirectoryEntry) = LocalRow(id, entry.key, entry.hash)

    @Test fun emptyLocalCreatesEverything() {
        val server = listOf(entry("contact:1"), entry("client:2"))
        val result = DirectoryDiff.diff(server, emptyList())

        assertEquals(server, result.creates)
        assertTrue(result.updates.isEmpty() && result.deletes.isEmpty())
    }

    @Test fun unchangedDirectoryIsAnEmptyDiff() {
        val server = listOf(entry("contact:1"), entry("client:2"))
        val local = server.mapIndexed { i, e -> rowFor(i + 10L, e) }

        assertTrue(DirectoryDiff.diff(server, local).isEmpty)
    }

    @Test fun detectsCreateUpdateAndDelete() {
        val kept = entry("contact:1")
        val changedOld = entry("contact:2", phone = "old")
        val changedNew = entry("contact:2", phone = "new")
        val gone = entry("contact:3")
        val added = entry("contact:4")

        val result = DirectoryDiff.diff(
            listOf(kept, changedNew, added),
            listOf(rowFor(1, kept), rowFor(2, changedOld), rowFor(3, gone)),
        )

        assertEquals(listOf(added), result.creates)
        assertEquals(listOf(ContactUpdate(2, changedNew)), result.updates)
        assertEquals(listOf(rowFor(3, gone)), result.deletes)
    }

    @Test fun duplicateLocalSourceIdsKeepTheLowestRawId() {
        val e = entry("contact:1")
        val result = DirectoryDiff.diff(listOf(e), listOf(rowFor(9, e), rowFor(4, e)))

        assertEquals(listOf(rowFor(9, e)), result.deletes)
        assertTrue(result.creates.isEmpty() && result.updates.isEmpty())
    }

    @Test fun localRowsWithoutASourceIdAreDeleted() {
        val orphan = LocalRow(5, "", "")
        val result = DirectoryDiff.diff(emptyList(), listOf(orphan))

        assertEquals(listOf(orphan), result.deletes)
    }
}
