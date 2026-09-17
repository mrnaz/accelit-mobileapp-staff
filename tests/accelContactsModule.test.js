import { describe, it, expect, vi, beforeEach } from 'vitest';

// The module is loaded fresh per test because it reads Platform.OS and looks
// the native module up once, at import time.
const load = async ({ os, native }) => {
    vi.resetModules();
    vi.doMock('react-native', () => ({ Platform: { OS: os } }));
    vi.doMock('expo', () => ({ requireOptionalNativeModule: vi.fn(() => native) }));

    return import('../modules/accel-contacts');
};

beforeEach(() => { vi.restoreAllMocks(); });

describe('accel-contacts JS API', () => {
    it('is inert off Android', async () => {
        const native = { enable: vi.fn() };
        const { default: contacts, OFF_STATUS } = await load({ os: 'ios', native });

        expect(contacts.isSupported()).toBe(false);
        await expect(contacts.enable()).resolves.toBeUndefined();
        await expect(contacts.getStatus()).resolves.toEqual(OFF_STATUS);
        expect(native.enable).not.toHaveBeenCalled();
    });

    it('is inert on Android when the native module is missing (Expo Go)', async () => {
        const { default: contacts, OFF_STATUS } = await load({ os: 'android', native: null });

        expect(contacts.isSupported()).toBe(false);
        await expect(contacts.syncNow()).resolves.toBeUndefined();
        await expect(contacts.getStatus()).resolves.toEqual(OFF_STATUS);
    });

    it('delegates to the native module on Android', async () => {
        const status = { enabled: true, hasPermission: true, accountExists: true, lastSuccessAt: 5, lastError: null };
        const native = {
            setSession: vi.fn(async () => {}),
            clearSession: vi.fn(async () => {}),
            enable: vi.fn(async () => {}),
            disable: vi.fn(async () => {}),
            syncNow: vi.fn(async () => {}),
            getStatus: vi.fn(async () => status),
        };
        const { default: contacts } = await load({ os: 'android', native });

        expect(contacts.isSupported()).toBe(true);

        await contacts.setSession('tok', 'https://x');
        await contacts.clearSession();
        await contacts.enable();
        await contacts.disable();
        await contacts.syncNow();

        expect(native.setSession).toHaveBeenCalledWith('tok', 'https://x');
        expect(native.clearSession).toHaveBeenCalled();
        expect(native.enable).toHaveBeenCalled();
        expect(native.disable).toHaveBeenCalled();
        expect(native.syncNow).toHaveBeenCalled();
        await expect(contacts.getStatus()).resolves.toEqual(status);
    });
});
