/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Every route in the app — the (main) tabs and the client/ticket/onboarding
// detail stacks that sit beside them — must be able to call useStaff(). The
// screen the mocked <Stack/> renders stands in for whichever route is active.
const mocks = vi.hoisted(() => {
    // useSegments is a subscription in expo-router: a navigation re-renders
    // whoever called it. RootLayoutInner is memoised with no props, so a plain
    // function returning an array would never wake it up after the first render.
    const listeners = new Set();
    const nav = {
        segments: [],
        get: () => nav.segments,
        set: (segments) => {
            nav.segments = segments;
            listeners.forEach((notify) => notify());
        },
        subscribe: (notify) => {
            listeners.add(notify);

            return () => listeners.delete(notify);
        },
    };

    return {
        nav,
        token: null,
        profile: null,
        screen: null,
        replace: vi.fn(),
        restore: vi.fn(),
        me: vi.fn(),
    };
});

vi.mock('react-native', async () => {
    const R = await import('react');

    return { View: ({ children }) => R.createElement('div', null, children) };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
        multiGet: async (keys) => keys.map((key) => [key, null]),
        multiRemove: async () => {},
    },
}));

vi.mock('expo-router', async () => {
    const R = await import('react');

    return {
        Stack: () => (mocks.screen ? mocks.screen() : null),
        useRouter: () => ({ replace: mocks.replace }),
        useSegments: () => R.useSyncExternalStore(mocks.nav.subscribe, mocks.nav.get),
        router: { replace: mocks.replace, push: vi.fn() },
    };
});

vi.mock('../app/services/api', () => ({
    default: { restore: mocks.restore, me: mocks.me },
}));

import RootLayout from '../app/_layout';
import { useStaff } from '../app/context/StaffContext';

function Probe() {
    const { staff } = useStaff();

    return React.createElement('span', null, staff?.fname ?? 'none');
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let caught;

const settle = async () => {
    // restore() → setIsChecking → provider effect → me() → setStaff is a chain
    // of microtasks, so give it a few turns of the loop.
    for (let i = 0; i < 3; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    }
};

const mount = async () => {
    await act(async () => { root.render(React.createElement(RootLayout)); });
    await settle();
};

// What api.restore() and api.me() will answer, then the navigation that
// triggers the root layout's auth check.
const navigate = async ({ segments, token, profile }) => {
    mocks.token = token;
    mocks.profile = profile;

    await act(async () => { mocks.nav.set(segments); });
    await settle();
};

beforeEach(() => {
    vi.clearAllMocks();
    caught = null;
    mocks.nav.segments = [];
    mocks.screen = () => React.createElement(Probe);
    mocks.restore.mockImplementation(async () => mocks.token);
    mocks.me.mockImplementation(async () => mocks.profile);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container, { onUncaughtError: (error) => { caught = error; } });
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
});

describe('RootLayout staff profile', () => {
    it('lets a detail screen outside (main) read the staff profile', async () => {
        await mount();
        await navigate({ segments: ['client', '[id]'], token: 'tok', profile: { fname: 'Jane' } });

        expect(caught).toBeNull();
        expect(container.textContent).toBe('Jane');
    });

    it('does not fetch the profile while signed out on an auth screen', async () => {
        await mount();
        await navigate({ segments: ['(auth)', 'login'], token: null, profile: null });

        expect(caught).toBeNull();
        expect(mocks.me).not.toHaveBeenCalled();
        expect(mocks.replace).not.toHaveBeenCalled();
        expect(container.textContent).toBe('none');
    });

    it('fetches the profile once a login lands in (main)', async () => {
        await mount();
        await navigate({ segments: ['(auth)', 'otp'], token: null, profile: null });
        expect(mocks.me).not.toHaveBeenCalled();

        await navigate({ segments: ['(main)'], token: 'tok', profile: { fname: 'Jane' } });

        expect(caught).toBeNull();
        expect(mocks.me).toHaveBeenCalledTimes(1);
        expect(container.textContent).toBe('Jane');
    });

    it('forgets the profile when the session ends', async () => {
        await mount();
        await navigate({ segments: ['(main)'], token: 'tok', profile: { fname: 'Jane' } });
        expect(container.textContent).toBe('Jane');

        await navigate({ segments: ['(auth)', 'login'], token: null, profile: null });

        expect(caught).toBeNull();
        expect(mocks.me).toHaveBeenCalledTimes(1);
        expect(container.textContent).toBe('none');
    });
});
