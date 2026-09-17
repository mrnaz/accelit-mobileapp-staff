package com.accelit.staffapp.contacts

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

sealed class FetchResult {
    data class Ok(val entries: List<DirectoryEntry>) : FetchResult()
    data class Failure(val kind: String) : FetchResult()
}

object DirectoryClient {
    private const val TIMEOUT_MS = 30_000

    // Only a 200 carrying a fully valid array is a directory. Everything else
    // is a Failure, and a Failure never reaches the Contacts Provider.
    fun fetch(baseUrl: String, token: String): FetchResult {
        var connection: HttpURLConnection? = null

        return try {
            connection = (URL("${baseUrl.trimEnd('/')}/api/address-book").openConnection() as HttpURLConnection).apply {
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
                // A redirect to a login page must not be followed into a 200.
                instanceFollowRedirects = false
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
            }

            when (val status = connection.responseCode) {
                200 -> {
                    val body = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }

                    DirectoryParser.parse(body)?.let { FetchResult.Ok(it) } ?: FetchResult.Failure("malformed")
                }
                401 -> FetchResult.Failure("auth")
                else -> FetchResult.Failure("http").also { android.util.Log.w("AccelContacts", "address-book answered $status") }
            }
        } catch (e: IOException) {
            FetchResult.Failure("network")
        } catch (e: Exception) {
            android.util.Log.w("AccelContacts", "address-book fetch failed", e)
            FetchResult.Failure("malformed")
        } finally {
            connection?.disconnect()
        }
    }
}
