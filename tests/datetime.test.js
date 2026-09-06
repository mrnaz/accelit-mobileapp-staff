import { describe, it, expect } from 'vitest';
import { parseApiDate, shortDate, ageDays } from '../app/utils/datetime.js';

describe('parseApiDate', () => {
    it('parses the postgres shape hermes rejects', () => {
        // Space separator, microseconds, colon-less offset.
        expect(parseApiDate('2026-08-15 11:14:39.172909+02')).not.toBeNull();
    });

    it('parses plain iso8601', () => {
        expect(parseApiDate('2026-08-15T11:14:39+02:00')).not.toBeNull();
    });

    it('parses a bare date', () => {
        expect(shortDate('2026-08-15')).toBe('15 Aug 2026');
    });

    it('returns null rather than an Invalid Date', () => {
        expect(parseApiDate(null)).toBeNull();
        expect(parseApiDate('')).toBeNull();
        expect(parseApiDate('not a date')).toBeNull();
        expect(shortDate('not a date')).toBeNull();
    });
});

describe('ageDays', () => {
    // Mirrors the web app's ticketAge: whole days since created_at, truncated.
    const now = new Date('2026-09-06T13:30:00+10:00');

    it('counts whole days since the date', () => {
        expect(ageDays('2026-08-13 09:00:00+10', now)).toBe(24);
    });

    it('truncates rather than rounds up', () => {
        expect(ageDays('2026-09-05T14:00:00+10:00', now)).toBe(0);
    });

    it('handles the postgres shape', () => {
        expect(ageDays('2026-08-10 11:14:39.172909+10', now)).toBe(27);
    });

    it('returns null for nothing or garbage', () => {
        expect(ageDays(null, now)).toBeNull();
        expect(ageDays('', now)).toBeNull();
        expect(ageDays('not a date', now)).toBeNull();
    });
});
