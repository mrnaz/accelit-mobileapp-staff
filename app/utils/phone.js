import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Numbers reach us as free text. The web app normalises on write through its
// form field, nothing normalises on read, and rows predating that field never
// went through it — client_contacts.phone is a plain VARCHAR(20). So everything
// here degrades rather than throwing.
const DEFAULT_COUNTRY = 'AU';

function parse(raw) {
    if (!raw || typeof raw !== 'string' || !raw.trim()) return null;

    try {
        return parsePhoneNumberFromString(raw.trim(), DEFAULT_COUNTRY) || null;
    } catch {
        return null;
    }
}

export function formatPhone(raw) {
    if (!raw || typeof raw !== 'string' || !raw.trim()) return null;

    const parsed = parse(raw);

    return parsed?.isValid() ? parsed.formatNational() : raw.trim();
}

export function dialUri(raw) {
    if (!raw || typeof raw !== 'string' || !raw.trim()) return null;

    const parsed = parse(raw);

    if (parsed?.isValid()) return `tel:${parsed.number}`;

    // Not a number we understand, but it may still be a dialable extension.
    // Keep a leading + if there was one, and give up when no digits remain.
    const cleaned = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');

    return cleaned.replace(/\D/g, '').length ? `tel:${cleaned}` : null;
}

export function mailUri(address) {
    if (!address || typeof address !== 'string') return null;

    const trimmed = address.trim();

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? `mailto:${trimmed}` : null;
}
