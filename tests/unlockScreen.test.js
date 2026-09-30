/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => {
    // Focus is a subscription in expo-router: the screen blurs when login is
    // pushed above it and focuses again when that is popped. Tests flip it by
    // hand.
    const listeners = new Set();
    const focus = {
        focused: true,
        get: () => focus.focused,
        set: (focused) => {
            focus.focused = focused;
            listeners.forEach((notify) => notify());
        },
        subscribe: (notify) => {
            listeners.add(notify);

            return () => listeners.delete(notify);
        },
    };

    // Live hardware-back handlers, newest last, as React Native keeps them.
    const backHandlers = [];

    return {
        focus,
        backHandlers,
        addBackListener: vi.fn((event, handler) => {
            backHandlers.push(handler);

            return { remove: () => backHandlers.splice(backHandlers.indexOf(handler), 1) };
        }),
        unlock: vi.fn(),
        lastEmail: vi.fn(async () => 'jo@accelit.com.au'),
        label: vi.fn(async () => 'Face ID'),
        replace: vi.fn(),
        push: vi.fn(),
    };
});

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
        BackHandler: { addEventListener: mocks.addBackListener },
    };
});

vi.mock('react-native-safe-area-context', async () => {
    const R = await import('react');

    return { SafeAreaView: ({ children }) => R.createElement('div', null, children) };
});

vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
// useFocusEffect runs its callback while the screen is focused and the
// callback's cleanup on blur or unmount.
vi.mock('expo-router', async () => {
    const R = await import('react');

    return {
        router: { replace: mocks.replace, push: mocks.push },
        useFocusEffect: (effect) => {
            const focused = R.useSyncExternalStore(mocks.focus.subscribe, mocks.focus.get);

            R.useEffect(() => (focused ? effect() : undefined), [focused, effect]);
        },
    };
});
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

// React Native asks the newest handler first and stops at the first true;
// false means the press falls through to navigation's own back.
const pressBack = () => [...mocks.backHandlers].reverse().some((handler) => handler() === true);

const setFocused = async (focused) => {
    await act(async () => { mocks.focus.set(focused); });
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.focus.focused = true;
    mocks.backHandlers.length = 0;
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

    // A rejected unlock must not leave the spinner up with a dead button.
    it('treats a thrown unlock as a failure and lets them try again', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.unlock.mockRejectedValueOnce(new Error('storage unavailable'));
        mocks.unlock.mockResolvedValue('cancelled');

        try {
            await mount();

            expect(container.textContent).toContain("Couldn't unlock. Try again, or sign in with your password.");
            expect(button('Unlock with Face ID')).toBeTruthy();
            expect(button('Unlock with Face ID').disabled).toBe(false);

            await tap('Unlock with Face ID');

            expect(mocks.unlock).toHaveBeenCalledTimes(2);
        } finally {
            warn.mockRestore();
        }
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

// A lock from a detail screen leaves the app's screens under the unlock screen,
// so a back press that reached navigation would pop straight past the lock.
describe('UnlockScreen back button', () => {
    beforeEach(() => {
        mocks.unlock.mockResolvedValue('cancelled');
    });

    it('swallows Android back while it is showing', async () => {
        await mount();

        expect(mocks.addBackListener).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
        expect(pressBack()).toBe(true);
    });

    it('lets back work on the login screen pushed above it, and takes over again on return', async () => {
        await mount();

        await setFocused(false);
        expect(mocks.backHandlers).toHaveLength(0);
        expect(pressBack()).toBe(false);

        await setFocused(true);
        expect(mocks.backHandlers).toHaveLength(1);
        expect(pressBack()).toBe(true);
    });

    it('stops listening once it is gone', async () => {
        await mount();
        expect(mocks.backHandlers).toHaveLength(1);

        await act(async () => { root.unmount(); });

        expect(mocks.backHandlers).toHaveLength(0);
    });
});
