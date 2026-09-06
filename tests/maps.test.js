import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { mapsQuery } from '../app/utils/maps.js';

describe('mapsQuery', () => {
    it('url-encodes the address', () => {
        expect(mapsQuery('1 Main St, Cheltenham VIC 3192')).toBe('1%20Main%20St%2C%20Cheltenham%20VIC%203192');
    });

    it('returns null for nothing', () => {
        expect(mapsQuery('')).toBeNull();
        expect(mapsQuery(null)).toBeNull();
    });
});
