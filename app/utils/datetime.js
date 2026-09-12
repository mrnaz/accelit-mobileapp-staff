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

// "Monday, 12 January, 2026 @ 1:37pm" — the ticket header's created-at line.
export function longDateTime(value) {
    const parsed = parseApiDate(value);

    return parsed ? parsed.format('dddd, D MMMM, YYYY @ h:mma') : null;
}

// "Mon, 2 Sep 2026 @ 3:27pm" — the stamp on an onboarding record, on the list
// and on the deployment page alike, so the same machine reads the same way in
// both places.
export function weekdayDateTime(value) {
    const parsed = parseApiDate(value);

    return parsed ? parsed.format('ddd, D MMM YYYY @ h:mma') : null;
}

// Whole days since `value`, truncated, the way the web ticket list's
// ticketAge does it: dayjs().diff(created_at, 'day'). `now` is injectable so
// tests can pin the clock.
export function ageDays(value, now = new Date()) {
    const parsed = parseApiDate(value);

    return parsed ? moment(now).diff(parsed, 'days') : null;
}
