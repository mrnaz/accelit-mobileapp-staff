package com.accelit.staffapp.contacts

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

// Turns the body of GET /api/address-book into entries. Returns null for
// anything short of a fully valid array: a partial directory must never be
// reconciled, because every row it is missing would read as a deletion.
object DirectoryParser {
    private val CONTACT_TYPES = setOf("client_contact", "general_contact")

    private class Builder(val type: String, row: JSONObject) {
        val given = DirectoryParser.text(row, "fname")
        val family = DirectoryParser.text(row, "sname")
        val displayName = DirectoryParser.text(row, "displayname")
        val clientName = DirectoryParser.text(row, "client_name")
        val phones = sortedSetOf<String>()
        val emails = sortedSetOf<String>()
    }

    fun parse(body: String): List<DirectoryEntry>? {
        val array = try {
            JSONArray(body)
        } catch (e: JSONException) {
            return null
        }

        val builders = LinkedHashMap<String, Builder>()

        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: return null
            val type = row.optString("type")

            val key = when (type) {
                in CONTACT_TYPES -> id(row, "contact_id")?.let { "contact:$it" }
                "client" -> id(row, "client_id")?.let { "client:$it" }
                else -> null
            } ?: return null

            // The API can repeat a person once per phone number. Names come
            // from the first row; numbers and addresses accumulate.
            val builder = builders.getOrPut(key) { Builder(type, row) }

            text(row, "phone")?.let { builder.phones.add(it) }
            text(row, "email")?.let { builder.emails.add(it) }
        }

        return builders.map { (key, b) ->
            val name = b.displayName
                ?: listOfNotNull(b.given, b.family).joinToString(" ").ifEmpty { null }
                ?: b.emails.firstOrNull()
                ?: b.phones.firstOrNull()
                ?: return null

            DirectoryEntry(
                key = key,
                given = b.given,
                family = b.family,
                displayName = name,
                organization = if (b.type == "client_contact") b.clientName else null,
                phones = b.phones.toList(),
                emails = b.emails.toList(),
            )
        }
    }

    private fun text(row: JSONObject, name: String): String? {
        if (row.isNull(name)) return null

        return row.optString(name).trim().ifEmpty { null }
    }

    private fun id(row: JSONObject, name: String): Long? {
        if (row.isNull(name)) return null

        val value = when (val raw = row.opt(name)) {
            is Number -> raw.toLong()
            is String -> raw.trim().toLongOrNull()
            else -> null
        }

        return value?.takeIf { it > 0 }
    }
}
