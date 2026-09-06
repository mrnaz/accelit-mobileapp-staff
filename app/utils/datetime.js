import moment from 'moment';

// Postgres hands back "2026-08-15 11:14:39.172909+02" — a space separator,
// microseconds, and a colon-less offset. Hermes' Date parser rejects that, so
// everything goes through moment rather than `new Date(value)`.
export function parseApiDate(value) {
    if (!value) return null;

    const parsed = moment(value, [
        moment.ISO_8601,
        'YYYY-MM-DD HH:mm:ss.SSSSSSZZ',
        'YYYY-MM-DD HH:mm:ssZZ',
        'YYYY-MM-DD HH:mm:ss',
        'YYYY-MM-DD',
    ], true);

    return parsed.isValid() ? parsed : null;
}

export function relativeTime(value) {
    const parsed = parseApiDate(value);

    return parsed ? parsed.fromNow() : null;
}

export function shortDate(value) {
    const parsed = parseApiDate(value);

    return parsed ? parsed.format('D MMM YYYY') : null;
}

export function dateTime(value) {
    const parsed = parseApiDate(value);

    return parsed ? parsed.format('D MMM YYYY, h:mma') : null;
}
