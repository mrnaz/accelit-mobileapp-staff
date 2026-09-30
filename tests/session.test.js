import { describe, it, expect, vi, beforeEach } from 'vitest';

// One place for everything the session touches, so each test can set the
// phone up the way it needs: which OS, what is stored, whether biometrics
// work, and what the OS answers a biometric read or write with.
const env = vi.hoisted(() => {
    const state = {
        os: 'ios',
        async: new Map(),
        secure: new Map(),
        usable: true,
        readError: null,
        readNull: false,
        writeError: null,
        legacyReadError: null,
        lastEmailReadError: null,
        types: [2],
    };

    state.getItemAsync = vi.fn(async (key) => {
        if (state.readError) throw state.readError;
        if (state.readNull) return null;

        return state.secure.get(key) ?? null;
    });
    state.setItemAsync = vi.fn(async (key, value) => {
        if (state.writeError) throw state.writeError;
        state.secure.set(key, value);
    });
    state.deleteItemAsync = vi.fn(async (key) => { state.secure.delete(key); });
    state.onSessionEnded = vi.fn(async () => {});

    return state;
});

vi.mock('react-native', () => ({ Platform: { get OS() { return env.os; } } }));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async (key) => {
            // Fails once, then behaves: a storage hiccup, not a broken phone.
            if (key === 'authToken' && env.legacyReadError) {
                const error = env.legacyReadError;
                env.legacyReadError = null;

                throw error;
            }

            if (key === 'lastEmail' && env.lastEmailReadError) throw env.lastEmailReadError;

            return env.async.get(key) ?? null;
        },
        setItem: async (key, value) => { env.async.set(key, value); },
        removeItem: async (key) => { env.async.delete(key); },
        multiRemove: async (keys) => { keys.forEach((key) => env.async.delete(key)); },
    },
}));

vi.mock('expo-secure-store', () => ({
    canUseBiometricAuthentication: () => env.usable,
    getItemAsync: env.getItemAsync,
    setItemAsync: env.setItemAsync,
    deleteItemAsync: env.deleteItemAsync,
}));

vi.mock('expo-local-authentication', () => ({
    supportedAuthenticationTypesAsync: async () => env.types,
}));

vi.mock('../app/utils/contactSync', () => ({ onSessionEnded: env.onSessionEnded }));

const KEY = 'staffAppSession';
const OPTIONS = { requireAuthentication: true, authenticationPrompt: 'Unlock Accel Staff' };
const EXPIRES = '2026-10-30T00:00:00+00:00';
const BEFORE_EXPIRY = Date.parse('2026-10-01T00:00:00Z');
const AFTER_EXPIRY = Date.parse('2026-11-01T00:00:00Z');

const marker = () => JSON.parse(env.async.get('sessionMarker') ?? 'null');

let session;

// The module keeps the token and the upgrade check in module state, so every
// test gets a fresh copy, loaded for the OS it wants.
const load = async (os = 'ios') => {
    env.os = os;
    vi.resetModules();
    session = await import('../app/services/session');
};

const signIn = (token = 'app-token') => session.start({ token, expires_at: EXPIRES }, 'jo@accelit.com.au');

beforeEach(async () => {
    env.async.clear();
    env.secure.clear();
    env.usable = true;
    env.readError = null;
    env.readNull = false;
    env.writeError = null;
    env.legacyReadError = null;
    env.lastEmailReadError = null;
    env.types = [2];
    vi.clearAllMocks();
    await load();
});

describe('start', () => {
    it('stores the token behind biometrics and remembers the email', async () => {
        await expect(signIn()).resolves.toBe(true);

        expect(env.setItemAsync).toHaveBeenCalledWith(KEY, 'app-token', OPTIONS);
        expect(marker()).toEqual({ expiresAt: EXPIRES });
        expect(env.async.get('lastEmail')).toBe('jo@accelit.com.au');
        expect(session.currentToken()).toBe('app-token');
    });

    it('keeps the token in memory only when no biometric is enrolled', async () => {
        env.usable = false;

        await expect(signIn()).resolves.toBe(false);

        expect(env.setItemAsync).not.toHaveBeenCalled();
        expect(marker()).toBeNull();
        expect(session.currentToken()).toBe('app-token');
        expect(env.async.get('lastEmail')).toBe('jo@accelit.com.au');
    });

    it('leaves no stored session behind when the write is refused, not even an older one', async () => {
        env.secure.set(KEY, 'old-token');
        env.async.set('sessionMarker', JSON.stringify({ expiresAt: EXPIRES }));
        env.writeError = new Error('Could not Authenticate the user: User canceled the authentication. Cancel');

        await expect(signIn('new-token')).resolves.toBe(false);

        expect(marker()).toBeNull();
        expect(env.secure.has(KEY)).toBe(false);
        expect(session.currentToken()).toBe('new-token');
        expect(await session.status(BEFORE_EXPIRY)).toBe('unlocked');
    });

    it('marks a session whose expiry the server did not send', async () => {
        await session.start({ token: 'app-token' }, 'jo@accelit.com.au');

        expect(marker()).toEqual({ expiresAt: null });
    });
});

describe('unlock', () => {
    beforeEach(async () => {
        await signIn();
        session.lock();
    });

    it('reads the token back after a match', async () => {
        await expect(session.unlock()).resolves.toBe('unlocked');

        expect(env.getItemAsync).toHaveBeenCalledWith(KEY, OPTIONS);
        expect(session.currentToken()).toBe('app-token');
    });

    it('clears the session when the OS has invalidated it', async () => {
        env.readNull = true;

        await expect(session.unlock()).resolves.toBe('changed');

        expect(marker()).toBeNull();
        expect(env.deleteItemAsync).toHaveBeenCalledWith(KEY, OPTIONS);
        expect(session.currentToken()).toBeNull();
    });

    it('keeps the session when the prompt is cancelled', async () => {
        env.readError = new Error('User canceled the operation.');

        await expect(session.unlock()).resolves.toBe('cancelled');

        expect(marker()).toEqual({ expiresAt: EXPIRES });
    });

    it('keeps the session when unlocking fails for another reason', async () => {
        env.readError = new Error('Could not Authenticate the user: Lockout. Too many attempts');

        await expect(session.unlock()).resolves.toBe('failed');

        expect(marker()).toEqual({ expiresAt: EXPIRES });
    });
});

describe('status', () => {
    it('is none with nothing stored', async () => {
        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('none');
    });

    it('is locked with a live stored session and nothing in memory', async () => {
        await signIn();
        session.lock();

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('locked');
    });

    it('is unlocked while the token is in memory', async () => {
        await signIn();

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('unlocked');
    });

    it('reports an expired session once, then forgets it', async () => {
        await signIn();
        session.lock();

        await expect(session.status(AFTER_EXPIRY)).resolves.toBe('expired');
        await expect(session.status(AFTER_EXPIRY)).resolves.toBe('none');
        expect(env.secure.has(KEY)).toBe(false);
    });

    it('clears a stored session that biometrics can no longer open', async () => {
        await signIn();
        session.lock();
        env.usable = false;

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('none');
        expect(marker()).toBeNull();
    });

    it('is none after the session ends, and the email stays', async () => {
        await signIn();
        await session.end();

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('none');
        await expect(session.lastEmail()).resolves.toBe('jo@accelit.com.au');
    });
});

describe('upgrading from 1.0.0', () => {
    it('deletes the old plain token and takes it off the contact worker, once', async () => {
        env.async.set('authToken', 'old-full-token');

        await session.status(BEFORE_EXPIRY);
        await session.status(BEFORE_EXPIRY);

        expect(env.async.has('authToken')).toBe(false);
        expect(env.onSessionEnded).toHaveBeenCalledTimes(1);
        expect(env.onSessionEnded).toHaveBeenCalledWith({ explicit: false });
    });

    it('leaves the contact worker alone when there was nothing to migrate', async () => {
        await session.status(BEFORE_EXPIRY);

        expect(env.onSessionEnded).not.toHaveBeenCalled();
    });

    it('still answers when the cleanup fails, now and on every later check', async () => {
        env.legacyReadError = new Error('storage unavailable');

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('none');
        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('none');
    });
});

describe('on web', () => {
    beforeEach(async () => { await load('web'); });

    it('keeps the token in AsyncStorage with no lock, as before', async () => {
        await expect(signIn()).resolves.toBe(true);

        expect(env.setItemAsync).not.toHaveBeenCalled();
        expect(env.async.get('webSessionToken')).toBe('app-token');
    });

    it('is still signed in after a page reload', async () => {
        await signIn();
        await load('web');

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('unlocked');
        expect(session.currentToken()).toBe('app-token');
    });

    it('signs out', async () => {
        await signIn();
        await session.end();
        await load('web');

        await expect(session.status(BEFORE_EXPIRY)).resolves.toBe('none');
    });
});

describe('lastEmail', () => {
    // The login screen reads it as it opens, and a throw there sent sign-in
    // to the VPN screen and round again.
    it('answers empty when the remembered email cannot be read', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = new Error('storage unavailable');
        env.lastEmailReadError = error;

        try {
            await expect(session.lastEmail()).resolves.toBe('');
            expect(warn).toHaveBeenCalledWith('session: could not read the remembered email', error);
        } finally {
            warn.mockRestore();
        }
    });
});

describe('label', () => {
    it('names the biometric the phone has', async () => {
        await expect(session.label()).resolves.toBe('Face ID');
    });
});
