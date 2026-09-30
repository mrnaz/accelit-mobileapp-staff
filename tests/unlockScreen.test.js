/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    unlock: vi.fn(),
    lastEmail: vi.fn(async () => 'jo@accelit.com.au'),
    label: vi.fn(async () => 'Face ID'),
    replace: vi.fn(),
    push: vi.fn(),
}));

vi.mock('react-native', async () => {
    const R = await import('react');
    const el = (tag, map = () => ({})) => ({ children, ...props }) => R.createElement(tag, map(props), children);

    return {
        View: el('div'),
        Text: el('span'),
        Image: () => R.createElement('img'),
        ActivityIndicator: el('progress'),
        TouchableOpacity: el('button', (p) => ({ onClick: p.onPress, disabled: p.disabled })),
        StyleSheet: { create: (s) => s },
    };
});

vi.mock('react-native-safe-area-context', async () => {
    const R = await import('react');

    return { SafeAreaView: ({ children }) => R.createElement('div', null, children) };
});

vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('expo-router', () => ({ router: { replace: mocks.replace, push: mocks.push } }));
vi.mock('../app/services/session', () => ({
    unlock: mocks.unlock,
    lastEmail: mocks.lastEmail,
    label: mocks.label,
}));

import UnlockScreen from '../app/(auth)/unlock';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const settle = async () => {
    for (let i = 0; i < 3; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    }
};

const mount = async (element = React.createElement(UnlockScreen)) => {
    await act(async () => { root.render(element); });
    await settle();
};

const button = (text) => [...container.querySelectorAll('button')].find((b) => b.textContent === text);

const tap = async (text) => {
    await act(async () => { button(text).click(); });
    await settle();
};

beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
});

describe('UnlockScreen', () => {
    it('asks as it opens and goes into the app on a match', async () => {
        mocks.unlock.mockResolvedValue('unlocked');

        await mount();

        expect(mocks.unlock).toHaveBeenCalledTimes(1);
        expect(mocks.replace).toHaveBeenCalledWith('/(main)');
    });

    // StrictMode runs effects twice. A second read while the first prompt is
    // up is refused on Android, and that refusal would read as a failure.
    it('asks only once even when the effect runs twice', async () => {
        mocks.unlock.mockResolvedValue('cancelled');

        await mount(React.createElement(React.StrictMode, null, React.createElement(UnlockScreen)));

        expect(mocks.unlock).toHaveBeenCalledTimes(1);
    });

    it('shows whose session it is and names the biometric', async () => {
        mocks.unlock.mockResolvedValue('cancelled');

        await mount();

        expect(container.textContent).toContain('jo@accelit.com.au');
        expect(button('Unlock with Face ID')).toBeTruthy();
    });

    it('stays quiet after a cancel and asks again on a tap', async () => {
        mocks.unlock.mockResolvedValue('cancelled');

        await mount();
        expect(container.textContent).not.toContain("Couldn't unlock");

        await tap('Unlock with Face ID');

        expect(mocks.unlock).toHaveBeenCalledTimes(2);
    });

    it('says so when unlocking fails', async () => {
        mocks.unlock.mockResolvedValue('failed');

        await mount();

        expect(container.textContent).toContain("Couldn't unlock. Try again, or sign in with your password.");
    });

    it('sends changed biometrics to the password sign-in', async () => {
        mocks.unlock.mockResolvedValue('changed');

        await mount();

        expect(mocks.replace).toHaveBeenCalledWith('/(auth)/login?reason=changed');
    });

    it('offers the password instead', async () => {
        mocks.unlock.mockResolvedValue('cancelled');

        await mount();
        await tap('Sign in with password');

        expect(mocks.push).toHaveBeenCalledWith('/(auth)/login');
    });
});
