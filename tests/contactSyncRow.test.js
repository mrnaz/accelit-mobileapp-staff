/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const OFF = { enabled: false, hasPermission: false, accountExists: false, lastSuccessAt: null, lastError: null };

const mocks = vi.hoisted(() => ({
    supported: true,
    status: null,
    turnOn: vi.fn(),
    turnOff: vi.fn(async () => {}),
    openSettings: vi.fn(),
}));

vi.mock('react-native', async () => {
    const R = await import('react');
    const el = (tag, map = () => ({})) => ({ children, ...props }) => R.createElement(tag, map(props), children);

    return {
        View: el('div'),
        Text: el('span'),
        TouchableOpacity: el('button', (p) => ({ onClick: p.onPress })),
        Switch: ({ value, onValueChange, disabled }) => R.createElement('input', {
            type: 'checkbox', checked: !!value, disabled, onChange: (e) => onValueChange(e.target.checked),
        }),
        Linking: { openSettings: mocks.openSettings },
        StyleSheet: { create: (s) => s },
    };
});

vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

vi.mock('../app/context/ThemeContext', () => ({
    default: {
        useTheme: () => ({
            theme: { colors: { surface: '#fff', border: '#ddd', primary: '#00f', textPrimary: '#000', textSecondary: '#666', error: '#f00' } },
        }),
    },
}));

vi.mock('../app/utils/contactSync', () => ({
    isSupported: () => mocks.supported,
    getStatus: async () => mocks.status,
    turnOn: mocks.turnOn,
    turnOff: mocks.turnOff,
    errorText: (kind) => (kind ? `error:${kind}` : null),
}));

import ContactSyncRow from '../app/components/ContactSyncRow';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host;
let roots = [];

const mount = async () => {
    host = document.createElement('div');
    document.body.appendChild(host);

    const root = createRoot(host);
    roots.push({ root, host });

    await act(async () => { root.render(<ContactSyncRow refreshKey={0} />); });
};

const toggle = async () => act(async () => { host.querySelector('input').click(); });

beforeEach(() => {
    mocks.supported = true;
    mocks.status = { ...OFF };
    mocks.turnOn.mockReset();
    mocks.turnOff.mockClear();
    mocks.openSettings.mockClear();
});

// A pending "look again shortly" timer (see ContactSyncRow) must not outlive
// its test: unmounting runs the effect cleanup that clears it.
afterEach(async () => {
    await act(async () => { roots.forEach(({ root }) => root.unmount()); });
    roots.forEach(({ host: h }) => h.remove());
    roots = [];
});

describe('ContactSyncRow', () => {
    it('renders nothing where contact sync is unsupported', async () => {
        mocks.supported = false;
        await mount();

        expect(host.textContent).toBe('');
    });

    it('starts off and explains itself', async () => {
        await mount();

        expect(host.querySelector('input').checked).toBe(false);
        expect(host.textContent).toContain('Show in phone contacts');
        expect(host.textContent).toContain('Adds the directory to caller ID on this phone.');
    });

    it('turns on when permission is granted', async () => {
        mocks.turnOn.mockImplementation(async () => {
            mocks.status = { ...OFF, enabled: true, hasPermission: true, accountExists: true };

            return { ok: true };
        });
        await mount();
        await toggle();

        expect(host.querySelector('input').checked).toBe(true);
        expect(host.textContent).toContain('Syncing…');
    });

    it('stays off and says why when permission is denied', async () => {
        mocks.turnOn.mockResolvedValue({ ok: false, reason: 'denied' });
        await mount();
        await toggle();

        expect(host.querySelector('input').checked).toBe(false);
        expect(host.textContent).toContain('Contacts permission is needed to show the directory in your phone.');
    });

    it('offers system settings when Android will not ask again', async () => {
        mocks.turnOn.mockResolvedValue({ ok: false, reason: 'blocked' });
        await mount();
        await toggle();

        await act(async () => { host.querySelector('button').click(); });

        expect(mocks.openSettings).toHaveBeenCalledTimes(1);
    });

    it('turns off', async () => {
        mocks.status = { ...OFF, enabled: true, hasPermission: true, accountExists: true, lastSuccessAt: Date.now() };
        mocks.turnOff.mockImplementation(async () => { mocks.status = { ...OFF }; });
        await mount();

        expect(host.textContent).toContain('Synced');

        await toggle();

        expect(mocks.turnOff).toHaveBeenCalledTimes(1);
        expect(host.querySelector('input').checked).toBe(false);
    });

    it('shows the last sync error', async () => {
        mocks.status = { ...OFF, enabled: true, hasPermission: true, accountExists: true, lastError: 'auth' };
        await mount();

        expect(host.textContent).toContain('error:auth');
    });

    it('warns when contacts permission has been revoked', async () => {
        mocks.status = { ...OFF, enabled: true, hasPermission: false, accountExists: true, lastSuccessAt: Date.now() };
        await mount();

        expect(host.textContent).toContain('error:permission');
        expect(host.textContent).not.toContain('Synced');
    });
});
