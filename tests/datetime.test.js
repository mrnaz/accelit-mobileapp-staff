import { describe, it, expect } from 'vitest';
import { parseApiDate, shortDate } from '../app/utils/datetime.js';

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
