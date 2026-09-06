import { describe, it, expect } from 'vitest';
import { avatarText } from '../app/utils/initials.js';

describe('avatarText', () => {
    it('takes the first letter of the first two words', () => {
        expect(avatarText('Australian Animal Protection Society')).toBe('AA');
    });

    it('gives one letter for a one-word name', () => {
        expect(avatarText('Drainpro')).toBe('D');
    });

    it('skips words that are only punctuation', () => {
        expect(avatarText('Dr MK & Co')).toBe('DM');
    });

    it('upper-cases and ignores stray whitespace', () => {
        expect(avatarText('  act now   taxation ')).toBe('AN');
    });

    it('returns an empty string when there is no name', () => {
        expect(avatarText(null)).toBe('');
        expect(avatarText('')).toBe('');
        expect(avatarText(' & ')).toBe('');
    });
});
