import { describe, it, expect } from 'vitest';
import { isIpRefusal, errorMessage } from '../app/utils/apiErrors.js';

describe('isIpRefusal', () => {
    it('recognises the IpWhitelist middleware refusal', () => {
        expect(isIpRefusal({
            message: 'Access denied. Your IP address is not authorized to access this resource.',
        })).toBe(true);
    });

    it('recognises the login controller refusal', () => {
        expect(isIpRefusal({
            errors: { ip: ['Access from your IP address is not permitted.'] },
        })).toBe(true);
    });

    it('does not mistake a bad password for a VPN problem', () => {
        expect(isIpRefusal({
            errors: { credentials: ['Invalid Username or Password.'] },
        })).toBe(false);
    });

    it('does not mistake an unrelated 403 for a VPN problem', () => {
        expect(isIpRefusal({ message: 'Unauthorized.' })).toBe(false);
    });

    it('handles an empty body', () => {
        expect(isIpRefusal(null)).toBe(false);
        expect(isIpRefusal(undefined)).toBe(false);
        expect(isIpRefusal({})).toBe(false);
    });
});

describe('errorMessage', () => {
    it('reads the message shape', () => {
        expect(errorMessage({ message: 'Unauthenticated.' })).toBe('Unauthenticated.');
    });

    it('reads the errors shape', () => {
        expect(errorMessage({ errors: { credentials: ['Invalid Username or Password.'] } }))
            .toBe('Invalid Username or Password.');
    });

    it('reads the lone error shape used by switch-mfa-method', () => {
        expect(errorMessage({ error: 'The selected MFA method is not available for your account.' }))
            .toBe('The selected MFA method is not available for your account.');
    });

    it('falls back when the body carries nothing usable', () => {
        expect(errorMessage(null, 'Request failed (500)')).toBe('Request failed (500)');
        expect(errorMessage({}, 'Request failed (500)')).toBe('Request failed (500)');
    });
});
