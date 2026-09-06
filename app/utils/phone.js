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

// SMS only makes sense to a mobile. Australian mobiles are 04xx and 05xx in
// national form; everything else (landlines, extensions, junk) gets null so
// the caller can dim its button. This checks the calling code and the raw
// national digits directly rather than isValid()/country: libphonenumber-js's
// AU metadata only allocates the 04 range, so isValid() is false and country
// is undefined for a real-looking 05 number, which would make it impossible
// to ever accept one.
export function smsUri(raw) {
    const parsed = parse(raw);

    if (!parsed || parsed.countryCallingCode !== '61') return null;
    if (!/^[45]\d{8}$/.test(parsed.nationalNumber)) return null;

    return `sms:${parsed.number}`;
}
