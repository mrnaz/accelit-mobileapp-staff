package com.accelit.staffapp.contacts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DeletionGuardTest {
    private fun ids(n: Int) = (1..n).map { "contact:$it" }

    @Test fun ordinaryDeletesGoStraightThrough() {
        val decision = DeletionGuard.decide(localCount = 100, deleteSourceIds = ids(3), pending = null)

        assertTrue(decision.applyDeletes)
        assertNull(decision.pendingFingerprint)
    }

    @Test fun noDeletesIsNeverSuspectAndClearsPending() {
        assertEquals(DeletionGuard.Decision(true, null), DeletionGuard.decide(0, emptyList(), "stale"))
    }

    @Test fun wipingEverythingIsWithheldOnce() {
        val first = DeletionGuard.decide(5, ids(5), null)
        assertFalse(first.applyDeletes)
        assertNotNull(first.pendingFingerprint)

        val second = DeletionGuard.decide(5, ids(5), first.pendingFingerprint)
        assertTrue(second.applyDeletes)
        assertNull(second.pendingFingerprint)
    }

    @Test fun moreThanHalfOfALargeSetIsWithheld() {
        assertFalse(DeletionGuard.decide(20, ids(11), null).applyDeletes)
        assertTrue("exactly half is fine", DeletionGuard.decide(20, ids(10), null).applyDeletes)
        assertTrue("small sets only trip on a full wipe", DeletionGuard.decide(10, ids(9), null).applyDeletes)
    }

    @Test fun aDifferentDeleteSetRestartsTheWait() {
        val first = DeletionGuard.decide(20, ids(15), null)
        val second = DeletionGuard.decide(20, ids(16), first.pendingFingerprint)

        assertFalse(second.applyDeletes)
        assertTrue(second.pendingFingerprint != first.pendingFingerprint)
    }

    @Test fun fingerprintIgnoresOrder() {
        val a = DeletionGuard.decide(5, ids(5), null).pendingFingerprint
        val b = DeletionGuard.decide(5, ids(5).reversed(), null).pendingFingerprint

        assertEquals(a, b)
    }
}
