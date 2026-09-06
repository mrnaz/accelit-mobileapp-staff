import { describe, it, expect } from 'vitest';
import { sanitizeOtp, isCompleteOtp } from '../app/utils/otp.js';

describe('sanitizeOtp', () => {
    it('keeps digits only and caps at six', () => {
        expect(sanitizeOtp('12 34-56 78')).toBe('123456');
        expect(sanitizeOtp('abc1')).toBe('1');
        expect(sanitizeOtp(null)).toBe('');
    });
});

describe('isCompleteOtp', () => {
    it('is true at six digits', () => {
        expect(isCompleteOtp('123456')).toBe(true);
        expect(isCompleteOtp('12345')).toBe(false);
    });
});
