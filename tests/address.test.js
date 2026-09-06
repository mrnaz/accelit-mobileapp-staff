import { describe, it, expect } from 'vitest';
import { addressLine } from '../app/utils/address.js';

describe('addressLine', () => {
    it('joins the parts that exist', () => {
        expect(addressLine({ address1: '1 Main St', address2: '', suburbcity: 'Cheltenham', state: 'VIC', postcode: '3192' }))
            .toBe('1 Main St, Cheltenham, VIC, 3192');
    });

    it('returns null when there is no address', () => {
        expect(addressLine(null)).toBeNull();
        expect(addressLine({})).toBeNull();
    });
});
