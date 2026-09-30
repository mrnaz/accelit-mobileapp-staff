import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({ data: new Map() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async (key) => store.data.get(key) ?? null,
        setItem: async (key, value) => { store.data.set(key, value); },
        removeItem: async (key) => { store.data.delete(key); },
        multiRemove: async (keys) => { keys.forEach((key) => store.data.delete(key)); },
    },
}));

vi.mock('expo-router', () => ({ router: { replace: vi.fn(), push: vi.fn() } }));

const sync = vi.hoisted(() => ({ onSessionStarted: vi.fn(async () => {}), onSessionEnded: vi.fn(async () => {}) }));

vi.mock('../app/utils/contactSync', () => sync);

const session = vi.hoisted(() => ({
    start: vi.fn(async () => true),
    end: vi.fn(async () => {}),
    currentToken: vi.fn(() => null),
}));

vi.mock('../app/services/session', () => session);

import { router } from 'expo-router';
import api, { API_BASE_URL } from '../app/services/api';
import { completeSignIn, abandonOtp, clearAuth, routePostAuth } from '../app/utils/authFlow';
import { STORAGE_KEYS } from '../app/constants/storageKeys';

const FULL = {
    token: 'app-token',
    contacts_token: 'contacts-token',
    expires_at: '2026-10-30T00:00:00+00:00',
};

beforeEach(() => {
    vi.clearAllMocks();
    store.data.clear();
    api.setOtpToken(null);
    api.setDeviceToken(null);
});

describe('completeSignIn', () => {
    it('starts the session with the email and drops the stub', async () => {
        api.setOtpToken('otp-stub');

        await completeSignIn(FULL, 'jo@accelit.com.au');

        expect(session.start).toHaveBeenCalledWith(FULL, 'jo@accelit.com.au');
        expect(api.otpToken).toBeNull();
    });

    it('gives contact sync the address-book token and never the full one', async () => {
        await completeSignIn(FULL, 'jo@accelit.com.au');

        expect(sync.onSessionStarted).toHaveBeenCalledWith('contacts-token', API_BASE_URL);
        expect(sync.onSessionStarted.mock.calls.flat()).not.toContain('app-token');
    });

    it('gives contact sync nothing when an older backend sends no contacts token', async () => {
        await completeSignIn({ token: 'app-token' }, 'jo@accelit.com.au');

        expect(sync.onSessionStarted).not.toHaveBeenCalled();
    });

    it('remembers the device when the server hands one back', async () => {
        await completeSignIn({ ...FULL, device_token: 'device-token' }, 'jo@accelit.com.au');

        expect(store.data.get(STORAGE_KEYS.mfaDeviceToken)).toBe('device-token');
        expect(api.deviceToken).toBe('device-token');
    });
});

describe('routePostAuth', () => {
    it('signs straight in on a full token', async () => {
        await routePostAuth(FULL, 'jo@accelit.com.au');

        expect(session.start).toHaveBeenCalledWith(FULL, 'jo@accelit.com.au');
        expect(router.replace).toHaveBeenCalledWith('/(main)');
    });

    it('carries the email to the code step', async () => {
        await routePostAuth({ otpToken: 'otp-stub', mfaType: 'totp' }, 'jo@accelit.com.au');

        expect(api.otpToken).toBe('otp-stub');
        expect(session.start).not.toHaveBeenCalled();
        expect(router.push).toHaveBeenCalledWith(expect.objectContaining({
            pathname: '/(auth)/otp',
            params: expect.objectContaining({ email: 'jo@accelit.com.au', mfaType: 'totp' }),
        }));
    });
});

describe('abandonOtp', () => {
    // Reached from "Sign in with password" on the unlock screen, the stored
    // session is still there to come back to. Backing out must not delete it.
    it('drops the stub and leaves a locked session alone', () => {
        api.setOtpToken('otp-stub');

        abandonOtp();

        expect(api.otpToken).toBeNull();
        expect(session.end).not.toHaveBeenCalled();
    });
});

describe('clearAuth', () => {
    it('ends the session and forgets the remembered device', async () => {
        store.data.set(STORAGE_KEYS.mfaDeviceToken, 'device-token');

        await clearAuth();

        expect(session.end).toHaveBeenCalledTimes(1);
        expect(store.data.has(STORAGE_KEYS.mfaDeviceToken)).toBe(false);
        expect(sync.onSessionEnded).toHaveBeenCalledWith({ explicit: false });
    });
});
