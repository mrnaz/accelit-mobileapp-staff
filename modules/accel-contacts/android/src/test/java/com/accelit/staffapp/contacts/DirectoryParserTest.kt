package com.accelit.staffapp.contacts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DirectoryParserTest {
    private val pat = """{"type":"client_contact","displayname":"Pat Smith","contact_id":44,"client_id":12,"fname":"Pat","sname":"Smith","client_name":"Accolade Screens","email":"pat@accolade.com.au","phone":"+61400000001"}"""
    private val vendor = """{"type":"general_contact","displayname":"Vendor Support","contact_id":90,"client_id":null,"fname":"Vendor","sname":"Support","client_name":null,"email":"support@vendor.com","phone":null}"""
    private val client = """{"type":"client","displayname":"Accolade Screens","contact_id":null,"client_id":12,"fname":null,"sname":null,"client_name":"Accolade Screens","email":"info@accolade.com.au","phone":"+61733330000"}"""

    @Test fun mapsTheThreeRowTypes() {
        val entries = DirectoryParser.parse("[$pat,$vendor,$client]")!!

        assertEquals(listOf("contact:44", "contact:90", "client:12"), entries.map { it.key })

        val first = entries[0]
        assertEquals("Pat", first.given)
        assertEquals("Smith", first.family)
        assertEquals("Pat Smith", first.displayName)
        assertEquals("Accolade Screens", first.organization)
        assertEquals(listOf("+61400000001"), first.phones)
        assertEquals(listOf("pat@accolade.com.au"), first.emails)

        assertNull("general contacts carry no organisation", entries[1].organization)
        assertEquals(emptyList<String>(), entries[1].phones)
        assertNull("a client's name is already its display name", entries[2].organization)
        assertNull(entries[2].given)
    }

    @Test fun mergesRowsThatShareAKey() {
        val second = pat.replace("+61400000001", "+61400000002")
        val entries = DirectoryParser.parse("[$pat,$second,$pat]")!!

        assertEquals(1, entries.size)
        assertEquals(listOf("+61400000001", "+61400000002"), entries[0].phones)
        assertEquals(listOf("pat@accolade.com.au"), entries[0].emails)
    }

    @Test fun anEmptyArrayIsAValidEmptyDirectory() {
        assertEquals(emptyList<DirectoryEntry>(), DirectoryParser.parse("[]"))
    }

    @Test fun rejectsAnythingThatIsNotAFullyValidArray() {
        assertNull(DirectoryParser.parse(""))
        assertNull(DirectoryParser.parse("<html>login</html>"))
        assertNull(DirectoryParser.parse("""{"message":"Unauthenticated."}"""))
        assertNull("non-object row", DirectoryParser.parse("[$pat, 5]"))
        assertNull("unknown type", DirectoryParser.parse("""[{"type":"staff","contact_id":1,"displayname":"x","phone":"1"}]"""))
        assertNull("contact without contact_id", DirectoryParser.parse("""[{"type":"client_contact","contact_id":null,"client_id":3,"displayname":"x","phone":"1"}]"""))
        assertNull("client without client_id", DirectoryParser.parse("""[{"type":"client","client_id":null,"displayname":"x","phone":"1"}]"""))
        assertNull("one bad row poisons the lot", DirectoryParser.parse("[$pat,$vendor,{}]"))
    }

    @Test fun fallsBackWhenDisplaynameIsMissing() {
        val row = """{"type":"general_contact","contact_id":7,"displayname":null,"fname":" Ann ","sname":"Lee","email":"a@b.c","phone":null}"""
        assertEquals("Ann Lee", DirectoryParser.parse("[$row]")!![0].displayName)

        val bare = """{"type":"general_contact","contact_id":8,"displayname":"","fname":null,"sname":null,"email":"a@b.c","phone":null}"""
        assertEquals("a@b.c", DirectoryParser.parse("[$bare]")!![0].displayName)
    }

    @Test fun hashIsStableAndSensitive() {
        val a = DirectoryParser.parse("[$pat]")!![0]
        val b = DirectoryParser.parse("[$pat]")!![0]
        val moved = DirectoryParser.parse("[${pat.replace("+61400000001", "+61400000009")}]")!![0]

        assertEquals(a.hash, b.hash)
        assertEquals(64, a.hash.length)
        assertNotEquals(a.hash, moved.hash)
    }

    @Test fun hashSeesCharactersMovingAcrossFields() {
        val split = DirectoryEntry("contact:1", "Pat", "Smith", "Pat Smith", null, listOf("1"), emptyList())
        val merged = split.copy(given = "PatSmith", family = "")

        assertNotEquals("an edit that only moves characters across a field boundary must change the hash", split.hash, merged.hash)

        val onePhone = split.copy(phones = listOf("12", "3"))
        val otherPhone = split.copy(phones = listOf("1", "23"))

        assertNotEquals("list separators must stop numbers bleeding into each other", onePhone.hash, otherPhone.hash)
    }
}
