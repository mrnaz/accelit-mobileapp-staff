import { describe, it, expect } from 'vitest';
import {
    LOCK_AFTER_MS, shouldLock, isExpired, routeFor, classifyUnlockFailure, unlockLabel, reasonMessage,
} from '../app/utils/sessionRules';

describe('shouldLock', () => {
    it('does not lock an app that never went to the background', () => {
        expect(shouldLock(null, 10 * LOCK_AFTER_MS)).toBe(false);
    });

    it('does not lock after a quick switch away', () => {
        expect(shouldLock(1000, 1000 + LOCK_AFTER_MS - 1)).toBe(false);
    });

    it('locks after five minutes away', () => {
        expect(LOCK_AFTER_MS).toBe(5 * 60 * 1000);
        expect(shouldLock(1000, 1000 + LOCK_AFTER_MS)).toBe(true);
    });
});

describe('isExpired', () => {
    const now = Date.parse('2026-10-01T00:00:00Z');

    it('is expired once expiresAt has passed', () => {
        expect(isExpired({ expiresAt: '2026-09-30T23:59:59+00:00' }, now)).toBe(true);
    });

    it('is live before expiresAt', () => {
        expect(isExpired({ expiresAt: '2026-10-30T00:00:00+00:00' }, now)).toBe(false);
    });

    // An older backend sends no expiry. The server's 401 still ends the
    // session; guessing "expired" here would throw a live one away.
    it('treats a missing or unreadable expiry as live', () => {
        expect(isExpired({ expiresAt: null }, now)).toBe(false);
        expect(isExpired({}, now)).toBe(false);
        expect(isExpired(null, now)).toBe(false);
        expect(isExpired({ expiresAt: 'soon' }, now)).toBe(false);
    });
});

describe('routeFor', () => {
    it('leaves an unlocked session where it is', () => {
        expect(routeFor({ status: 'unlocked', inAuthGroup: false })).toBeNull();
    });

    it('sends a locked session to the unlock screen', () => {
        expect(routeFor({ status: 'locked', inAuthGroup: false })).toBe('/(auth)/unlock');
    });

    // "Sign in with password" takes a locked session to the login screen on
    // purpose, and backing out of the code step lands there too.
    it('leaves a locked session on an auth screen', () => {
        expect(routeFor({ status: 'locked', inAuthGroup: true })).toBeNull();
    });

    it('sends an expired session to sign-in and says why', () => {
        expect(routeFor({ status: 'expired', inAuthGroup: false })).toBe('/(auth)/login?reason=expired');
    });

    it('sends no session to sign-in', () => {
        expect(routeFor({ status: 'none', inAuthGroup: false })).toBe('/(auth)/login');
        expect(routeFor({ status: 'none', inAuthGroup: true })).toBeNull();
    });
});

describe('classifyUnlockFailure', () => {
    it('reads the Android cancel', () => {
        const error = new Error('Could not Authenticate the user: User canceled the authentication. Cancel');

        expect(classifyUnlockFailure(error)).toBe('cancelled');
    });

    it('reads the iOS cancel', () => {
        expect(classifyUnlockFailure(new Error('User canceled the operation.'))).toBe('cancelled');
    });

    it('treats anything else as a failure', () => {
        expect(classifyUnlockFailure(new Error('Could not Authenticate the user: Lockout. Too many attempts'))).toBe('failed');
        expect(classifyUnlockFailure(undefined)).toBe('failed');
    });
});

describe('unlockLabel', () => {
    // expo-local-authentication: FINGERPRINT = 1, FACIAL_RECOGNITION = 2.
    it('names what an iPhone has', () => {
        expect(unlockLabel('ios', [2])).toBe('Face ID');
        expect(unlockLabel('ios', [1])).toBe('Touch ID');
    });

    it('prefers the fingerprint on Android, where most face unlock is too weak for the keystore', () => {
        expect(unlockLabel('android', [1, 2])).toBe('fingerprint');
        expect(unlockLabel('android', [2])).toBe('face unlock');
    });

    it('falls back to a generic name', () => {
        expect(unlockLabel('android', [])).toBe('biometrics');
        expect(unlockLabel('ios', [])).toBe('biometrics');
    });
});

describe('reasonMessage', () => {
    it('explains an expired session', () => {
        expect(reasonMessage('expired', 'Face ID')).toBe('Your session expired — sign in again.');
    });

    it('explains changed biometrics by name', () => {
        expect(reasonMessage('changed', 'Face ID')).toBe('Face ID changed on this phone — sign in with your password.');
        expect(reasonMessage('changed', 'fingerprint')).toBe('Fingerprint changed on this phone — sign in with your password.');
    });

    it('says nothing without a reason', () => {
        expect(reasonMessage(undefined, 'Face ID')).toBeNull();
    });
});
