// Initials for an avatar: the first letter of the first two words, so
// "Australian Animal Protection Society" -> "AA" and "Drainpro" -> "D".
// Words with no letters or digits (an "&", a dash) are skipped.
export function avatarText(name) {
    const words = String(name || '')
        .split(/\s+/)
        .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
        .filter(Boolean);

    return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('');
}
