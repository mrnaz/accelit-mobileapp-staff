import { describe, it, expect } from 'vitest';
import { formatPhone, dialUri, mailUri } from '../app/utils/phone.js';

describe('formatPhone', () => {
    it('formats a stored australian mobile', () => {
        expect(formatPhone('0400000000')).toBe('0400 000 000');
    });

    it('formats a stored e164 number', () => {
        expect(formatPhone('+61400000000')).toBe('0400 000 000');
    });

    it('returns unparseable input unchanged rather than hiding it', () => {
        expect(formatPhone('ext 4402')).toBe('ext 4402');
    });

    it('returns null when there is nothing to show', () => {
        expect(formatPhone(null)).toBeNull();
        expect(formatPhone('')).toBeNull();
        expect(formatPhone('   ')).toBeNull();
    });
});

describe('dialUri', () => {
    it('dials e164 when the number parses', () => {
        expect(dialUri('0400 000 000')).toBe('tel:+61400000000');
    });

    it('falls back to the raw digits for an extension', () => {
        expect(dialUri('ext 4402')).toBe('tel:4402');
    });

    it('returns null when there is nothing dialable', () => {
        expect(dialUri('n/a')).toBeNull();
        expect(dialUri(null)).toBeNull();
        expect(dialUri('')).toBeNull();
    });
});

describe('mailUri', () => {
    it('builds a mailto', () => {
        expect(mailUri('jane@example.test')).toBe('mailto:jane@example.test');
    });

    it('refuses anything that is not an address', () => {
        expect(mailUri('not an email')).toBeNull();
        expect(mailUri(null)).toBeNull();
    });
});
