import { describe, it, expect, vi, beforeEach } from 'vitest';

// The MFA stub token from POST /login lives only in memory: it is never
// persisted, because it can do nothing but exchange an OTP. The root layout
// calls restore() on every navigation, including login -> otp, so restore()
// must not wipe that stub just because storage has no full token yet.
const store = vi.hoisted(() => ({ data: new Map() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async (key) => store.data.get(key) ?? null,
        setItem: async (key, value) => { store.data.set(key, value); },
        removeItem: async (key) => { store.data.delete(key); },
        multiGet: async (keys) => keys.map((key) => [key, store.data.get(key) ?? null]),
        multiRemove: async (keys) => { keys.forEach((key) => store.data.delete(key)); },
    },
}));

vi.mock('expo-router', () => ({ router: { replace: vi.fn(), push: vi.fn() } }));

import api from '../app/services/api';
import { STORAGE_KEYS } from '../app/constants/storageKeys';

beforeEach(() => {
    store.data.clear();
    api.setToken(null);
    api.setDeviceToken(null);
});

describe('api.restore', () => {
    it('loads the persisted token and device token', async () => {
        store.data.set(STORAGE_KEYS.token, 'full-token');
        store.data.set(STORAGE_KEYS.mfaDeviceToken, 'device-token');

        await expect(api.restore()).resolves.toBe('full-token');
        expect(api.token).toBe('full-token');
        expect(api.deviceToken).toBe('device-token');
    });

    it('keeps the in-memory OTP stub when storage has no token yet', async () => {
        api.setToken('otp-stub');

        await expect(api.restore()).resolves.toBeNull();
        expect(api.token).toBe('otp-stub');
    });

    it('still reports no session while the stub is the only token', async () => {
        api.setToken('otp-stub');

        // The auth check redirects on this value, not on the in-memory token.
        expect(await api.restore()).toBeNull();
    });
});

// A 401 means "your session is over" only when a session was sent. The login
// route answers a wrong password with 401 too; bouncing to the login screen
// on that remounts the form and loses the error before it is shown.
import { router } from 'expo-router';

const reply = (status, body) => vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
}));

describe('api 401 handling', () => {
    beforeEach(() => {
        router.replace.mockClear();
    });

    it('surfaces a wrong password as an error instead of restarting the login screen', async () => {
        vi.stubGlobal('fetch', reply(401, { errors: { credentials: ['Invalid Username or Password.'] } }));

        await expect(api.login('jo@accelit.com.au', 'nope')).rejects.toMatchObject({
            status: 401,
            message: 'Invalid Username or Password.',
        });
        expect(router.replace).not.toHaveBeenCalled();
        expect(store.data.size).toBe(0);
    });

    it('still ends the session when an authenticated request gets a 401', async () => {
        store.data.set(STORAGE_KEYS.token, 'full-token');
        api.setToken('full-token');
        vi.stubGlobal('fetch', reply(401, { message: 'Unauthenticated.' }));

        await expect(api.me()).rejects.toMatchObject({ status: 401 });
        expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
        expect(api.token).toBeNull();
        expect(store.data.has(STORAGE_KEYS.token)).toBe(false);
    });
});
