#!/usr/bin/env bash
# Compiles and runs the pure-Kotlin core tests without Gradle or an Android SDK.
# Needs: brew install kotlin openjdk
set -euo pipefail
cd "$(dirname "$0")/.."

command -v kotlinc >/dev/null || { echo "kotlinc not found: brew install kotlin openjdk" >&2; exit 2; }

LIB=.core-test/lib
OUT=.core-test/core-tests.jar
mkdir -p "$LIB"

fetch() { [ -f "$LIB/$2" ] || curl -fsSL "$1" -o "$LIB/$2"; }
M=https://repo1.maven.org/maven2
fetch $M/org/json/json/20240303/json-20240303.jar json.jar
fetch $M/junit/junit/4.13.2/junit-4.13.2.jar junit.jar
fetch $M/org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar hamcrest.jar

SRC=android/src/main/java/com/accelit/staffapp/contacts
TEST=android/src/test/java/com/accelit/staffapp/contacts
CP="$LIB/json.jar:$LIB/junit.jar:$LIB/hamcrest.jar"

kotlinc "$SRC/DirectoryEntry.kt" "$SRC/DirectoryParser.kt" "$SRC/DirectoryDiff.kt" "$SRC/DeletionGuard.kt" \
    "$TEST"/*.kt -cp "$CP" -include-runtime -d "$OUT" 2>&1 | grep -v '^warning:' || true

java -cp "$OUT:$CP" org.junit.runner.JUnitCore \
    com.accelit.staffapp.contacts.DirectoryParserTest \
    com.accelit.staffapp.contacts.DirectoryDiffTest \
    com.accelit.staffapp.contacts.DeletionGuardTest
