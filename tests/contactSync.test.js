import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    supported: true,
    status: null,
    permissions: {},
    native: {},
}));

vi.mock('react-native', () => ({
    PermissionsAndroid: {
        PERMISSIONS: { READ_CONTACTS: 'read', WRITE_CONTACTS: 'write' },
        RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' },
        requestMultiple: vi.fn(async () => mocks.permissions),
    },
}));

vi.mock('../modules/accel-contacts', () => {
    const OFF_STATUS = { enabled: false, hasPermission: false, accountExists: false, lastSuccessAt: null, lastError: null };

    mocks.native = {
        isSupported: vi.fn(() => mocks.supported),
        setSession: vi.fn(async () => {}),
        clearSession: vi.fn(async () => {}),
        enable: vi.fn(async () => {}),
        disable: vi.fn(async () => {}),
        syncNow: vi.fn(async () => {}),
        getStatus: vi.fn(async () => mocks.status ?? OFF_STATUS),
    };

    return { default: mocks.native, OFF_STATUS };
});

import {
    STALE_MS, turnOn, turnOff, refreshIfStale, requestSync, getStatus,
    onSessionStarted, onSessionEnded, errorText,
} from '../app/utils/contactSync';

const NOW = 1_800_000_000_000;
const enabled = (extra = {}) => ({
    enabled: true, hasPermission: true, accountExists: true, lastSuccessAt: NOW, lastError: null, ...extra,
});

beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.supported = true;
    mocks.status = null;
    mocks.permissions = { read: 'granted', write: 'granted' };
    await onSessionEnded({ explicit: false });
    vi.clearAllMocks();
});

describe('turnOn', () => {
    it('enables once both permissions are granted', async () => {
        await expect(turnOn()).resolves.toEqual({ ok: true });
        expect(mocks.native.enable).toHaveBeenCalledTimes(1);
    });

    it('stays off when a permission is denied', async () => {
        mocks.permissions = { read: 'granted', write: 'denied' };

        await expect(turnOn()).resolves.toEqual({ ok: false, reason: 'denied' });
        expect(mocks.native.enable).not.toHaveBeenCalled();
    });

    it('reports blocked when Android will not ask again', async () => {
        mocks.permissions = { read: 'never_ask_again', write: 'never_ask_again' };

        await expect(turnOn()).resolves.toEqual({ ok: false, reason: 'blocked' });
    });

    it('does nothing where the module is absent', async () => {
        mocks.supported = false;

        await expect(turnOn()).resolves.toEqual({ ok: false, reason: 'unsupported' });
    });

    it('turns a native failure into a result, not a throw', async () => {
        mocks.native.enable.mockRejectedValueOnce(new Error('boom'));

        await expect(turnOn()).resolves.toEqual({ ok: false, reason: 'error' });
    });
});

describe('refreshIfStale', () => {
    it('does nothing while the feature is off', async () => {
        await expect(refreshIfStale(NOW)).resolves.toBe(false);
        expect(mocks.native.syncNow).not.toHaveBeenCalled();
    });

    it('does nothing inside the hour', async () => {
        mocks.status = enabled({ lastSuccessAt: NOW - STALE_MS + 1 });

        await expect(refreshIfStale(NOW)).resolves.toBe(false);
    });

    it('syncs once the last success is an hour old', async () => {
        mocks.status = enabled({ lastSuccessAt: NOW - STALE_MS });

        await expect(refreshIfStale(NOW)).resolves.toBe(true);
        expect(mocks.native.syncNow).toHaveBeenCalledTimes(1);
    });

    it('syncs when the directory has never been populated', async () => {
        mocks.status = enabled({ lastSuccessAt: null });

        await expect(refreshIfStale(NOW)).resolves.toBe(true);
    });

    it('syncs when the last attempt failed, however recent the last success', async () => {
        mocks.status = enabled({ lastError: 'auth' });

        await expect(refreshIfStale(NOW)).resolves.toBe(true);
    });
});

describe('session wiring', () => {
    it('hands the token to native once per token', async () => {
        await onSessionStarted('tok', 'https://api');
        await onSessionStarted('tok', 'https://api');

        expect(mocks.native.setSession).toHaveBeenCalledTimes(1);
        expect(mocks.native.setSession).toHaveBeenCalledWith('tok', 'https://api');

        await onSessionStarted('tok-2', 'https://api');
        expect(mocks.native.setSession).toHaveBeenCalledTimes(2);
    });

    it('populates an enabled but empty directory right after login', async () => {
        mocks.status = enabled({ lastSuccessAt: null });

        await onSessionStarted('tok', 'https://api');

        expect(mocks.native.syncNow).toHaveBeenCalledTimes(1);
    });

    it('an expired session forgets the token but keeps the contacts', async () => {
        await onSessionEnded({ explicit: false });

        expect(mocks.native.clearSession).toHaveBeenCalledTimes(1);
        expect(mocks.native.disable).not.toHaveBeenCalled();
    });

    it('signing out removes the account and the contacts with it', async () => {
        await onSessionEnded({ explicit: true });

        expect(mocks.native.disable).toHaveBeenCalledTimes(1);
        expect(mocks.native.clearSession).toHaveBeenCalledTimes(1);
    });

    it('never lets a native failure escape into the auth flow', async () => {
        mocks.native.setSession.mockRejectedValueOnce(new Error('boom'));
        mocks.native.disable.mockRejectedValueOnce(new Error('boom'));
        mocks.native.getStatus.mockRejectedValueOnce(new Error('boom'));

        await expect(onSessionStarted('tok', 'https://api')).resolves.toBeUndefined();
        await expect(onSessionEnded({ explicit: true })).resolves.toBeUndefined();
        await expect(getStatus()).resolves.toMatchObject({ enabled: false });
        expect(mocks.native.clearSession).toHaveBeenCalled();
    });
});

describe('small things', () => {
    it('turnOff and requestSync delegate', async () => {
        await turnOff();
        await requestSync();

        expect(mocks.native.disable).toHaveBeenCalledTimes(1);
        expect(mocks.native.syncNow).toHaveBeenCalledTimes(1);
    });

    it('explains each failure in plain words', () => {
        expect(errorText(null)).toBeNull();
        expect(errorText('auth')).toBe('Sign in again to keep contacts up to date.');
        expect(errorText('permission')).toBe('Contacts permission was turned off.');
        expect(errorText('network')).toBe('Could not reach the server. Will retry.');
        expect(errorText('http')).toBe('Could not reach the server. Will retry.');
        expect(errorText('malformed')).toBe('Last sync failed. Will retry.');
        expect(errorText('provider')).toBe('Last sync failed. Will retry.');
    });
});
