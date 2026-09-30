import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const session = vi.hoisted(() => ({ token: null, currentToken: vi.fn(), end: vi.fn(async () => {}) }));

vi.mock('../app/services/session', () => ({ currentToken: session.currentToken, end: session.end }));

import { router } from 'expo-router';
import api from '../app/services/api';
import { STORAGE_KEYS } from '../app/constants/storageKeys';

const reply = (status, body) => vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
}));

const sentHeaders = () => fetch.mock.calls[0][1].headers;

beforeEach(() => {
    vi.clearAllMocks();
    store.data.clear();
    api.setOtpToken(null);
    api.setDeviceToken(null);
    session.token = null;
    session.currentToken.mockImplementation(() => session.token);
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('what a request carries', () => {
    it('names the staff app, so sign-in mints app tokens', async () => {
        vi.stubGlobal('fetch', reply(200, { allowed: true }));

        await api.ipCheck();

        expect(sentHeaders()['X-Accel-Client']).toBe('staff-app');
    });

    it('sends the session token', async () => {
        session.token = 'app-token';
        vi.stubGlobal('fetch', reply(200, {}));

        await api.me();

        expect(sentHeaders().Authorization).toBe('Bearer app-token');
    });

    it('sends the OTP stub during the code step', async () => {
        api.setOtpToken('otp-stub');
        vi.stubGlobal('fetch', reply(200, { verified: false }));

        await api.checkOtp('123456', true);

        expect(sentHeaders().Authorization).toBe('Bearer otp-stub');
    });

    // A back gesture can leave the stub in memory. It can only exchange a
    // code, so it must not shadow the session token on any other request.
    it('sends the session token, not a stale OTP stub, on an ordinary request', async () => {
        api.setOtpToken('otp-stub');
        session.token = 'app-token';
        vi.stubGlobal('fetch', reply(200, {}));

        await api.me();

        expect(sentHeaders().Authorization).toBe('Bearer app-token');
    });

    it('still sends the OTP stub with the code, even when a session token exists', async () => {
        api.setOtpToken('otp-stub');
        session.token = 'app-token';
        vi.stubGlobal('fetch', reply(200, { verified: false }));

        await api.checkOtp('123456', true);

        expect(sentHeaders().Authorization).toBe('Bearer otp-stub');
    });

    it('sends the OTP stub when switching the MFA method', async () => {
        api.setOtpToken('otp-stub');
        session.token = 'app-token';
        vi.stubGlobal('fetch', reply(200, {}));

        await api.switchMfaMethod('sms');

        expect(sentHeaders().Authorization).toBe('Bearer otp-stub');
    });

    it('sends no token with the password itself', async () => {
        session.token = 'app-token';
        vi.stubGlobal('fetch', reply(200, {}));

        await api.login('jo@accelit.com.au', 'secret-pass');

        expect(sentHeaders().Authorization).toBeUndefined();
    });

    it('sends the remembered device with the password', async () => {
        store.data.set(STORAGE_KEYS.mfaDeviceToken, 'device-token');
        vi.stubGlobal('fetch', reply(200, {}));

        await api.loadDeviceToken();
        await api.login('jo@accelit.com.au', 'secret-pass');

        expect(sentHeaders()['X-MFA-Device-Token']).toBe('device-token');
    });
});

// A 401 means "that token is dead" only when a token was sent. The login
// route answers a wrong password with 401 too; bouncing to the login screen
// on that remounts the form and loses the error before it is shown.
describe('401 handling', () => {
    it('surfaces a wrong password as an error instead of restarting the login screen', async () => {
        vi.stubGlobal('fetch', reply(401, { errors: { credentials: ['Invalid Username or Password.'] } }));

        await expect(api.login('jo@accelit.com.au', 'nope')).rejects.toMatchObject({
            status: 401,
            message: 'Invalid Username or Password.',
        });
        expect(router.replace).not.toHaveBeenCalled();
        expect(session.end).not.toHaveBeenCalled();
    });

    it('ends a dead session, stored copy included, and says why', async () => {
        session.token = 'dead-token';
        store.data.set(STORAGE_KEYS.mfaDeviceToken, 'device-token');
        vi.stubGlobal('fetch', reply(401, { message: 'Unauthenticated.' }));

        await expect(api.me()).rejects.toMatchObject({ status: 401 });

        expect(session.end).toHaveBeenCalledTimes(1);
        expect(sync.onSessionEnded).toHaveBeenCalledWith({ explicit: false });
        expect(router.replace).toHaveBeenCalledWith('/(auth)/login?reason=expired');
        expect(store.data.has(STORAGE_KEYS.mfaDeviceToken)).toBe(false);
    });

    it('treats a 401 on an ordinary request as a dead session even with a stale stub in memory', async () => {
        api.setOtpToken('otp-stub');
        session.token = 'dead-token';
        vi.stubGlobal('fetch', reply(401, { message: 'Unauthenticated.' }));

        await expect(api.me()).rejects.toMatchObject({ status: 401 });

        expect(session.end).toHaveBeenCalledTimes(1);
        expect(sync.onSessionEnded).toHaveBeenCalledWith({ explicit: false });
        expect(router.replace).toHaveBeenCalledWith('/(auth)/login?reason=expired');
    });

    it('drops a dead OTP stub without touching a locked session', async () => {
        api.setOtpToken('otp-stub');
        vi.stubGlobal('fetch', reply(401, { message: 'Unauthenticated.' }));

        await expect(api.checkOtp('123456', false)).rejects.toMatchObject({ status: 401 });

        expect(session.end).not.toHaveBeenCalled();
        expect(api.otpToken).toBeNull();
        expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
    });
});
