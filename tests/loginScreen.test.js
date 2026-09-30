/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    params: {},
    inputs: {},
    remembered: 'jo@accelit.com.au',
    label: 'Face ID',
    replace: vi.fn(),
    push: vi.fn(),
    ipCheck: vi.fn(async () => ({ allowed: true })),
    loadDeviceToken: vi.fn(async () => {}),
    login: vi.fn(async () => ({ token: 'app-token' })),
    routePostAuth: vi.fn(async () => {}),
}));

vi.mock('react-native', async () => {
    const R = await import('react');
    const el = (tag, map = () => ({})) => ({ children, ...props }) => R.createElement(tag, map(props), children);

    return {
        View: el('div'),
        Text: el('span'),
        Image: () => R.createElement('img'),
        ScrollView: el('div'),
        KeyboardAvoidingView: el('div'),
        ActivityIndicator: el('progress'),
        TouchableOpacity: el('button', (p) => ({ onClick: p.onPress, disabled: p.disabled, 'aria-label': p.accessibilityLabel })),
        // Keep each field's props, so a test can type by calling onChangeText.
        TextInput: (props) => {
            mocks.inputs[props.textContentType] = props;

            return R.createElement('input', {
                readOnly: true,
                value: props.value ?? '',
                'data-kind': props.textContentType,
                'data-autofocus': String(!!props.autoFocus),
            });
        },
        StyleSheet: { create: (s) => s },
        Platform: { OS: 'ios' },
    };
});

vi.mock('react-native-safe-area-context', async () => {
    const R = await import('react');

    return { SafeAreaView: ({ children }) => R.createElement('div', null, children) };
});

vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('expo-router', () => ({
    router: { replace: mocks.replace, push: mocks.push },
    useLocalSearchParams: () => mocks.params,
}));
vi.mock('../app/services/api', () => ({
    default: { ipCheck: mocks.ipCheck, loadDeviceToken: mocks.loadDeviceToken, login: mocks.login },
}));
vi.mock('../app/utils/authFlow', () => ({ routePostAuth: mocks.routePostAuth }));
vi.mock('../app/services/session', () => ({
    lastEmail: async () => mocks.remembered,
    label: async () => mocks.label,
}));

import LoginScreen from '../app/(auth)/login';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const settle = async () => {
    for (let i = 0; i < 4; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    }
};

const mount = async () => {
    await act(async () => { root.render(React.createElement(LoginScreen)); });
    await settle();
};

const field = (kind) => container.querySelector(`input[data-kind="${kind}"]`);

beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = {};
    mocks.inputs = {};
    mocks.remembered = 'jo@accelit.com.au';
    mocks.label = 'Face ID';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
});

describe('LoginScreen', () => {
    it('fills in the remembered email and starts in the password box', async () => {
        await mount();

        expect(field('username').value).toBe('jo@accelit.com.au');
        expect(field('password').dataset.autofocus).toBe('true');
    });

    it('starts empty on a first sign-in', async () => {
        mocks.remembered = '';

        await mount();

        expect(field('username').value).toBe('');
        expect(field('password').dataset.autofocus).toBe('false');
    });

    it('loads the remembered device before the password is sent', async () => {
        await mount();

        expect(mocks.loadDeviceToken).toHaveBeenCalledTimes(1);
    });

    it('says the session expired', async () => {
        mocks.params = { reason: 'expired' };

        await mount();

        expect(container.textContent).toContain('Your session expired — sign in again.');
    });

    it('says the biometrics changed, by name', async () => {
        mocks.params = { reason: 'changed' };

        await mount();

        expect(container.textContent).toContain('Face ID changed on this phone — sign in with your password.');
    });

    it('says nothing when there is no reason', async () => {
        await mount();

        expect(container.textContent).not.toContain('sign in again');
        expect(container.textContent).not.toContain('changed on this phone');
    });

    it('hands the email it signed in with to the sign-in flow', async () => {
        await mount();

        await act(async () => { mocks.inputs.password.onChangeText('secret-pass'); });
        await act(async () => {
            [...container.querySelectorAll('button')].find((b) => b.textContent === 'Sign in').click();
        });
        await settle();

        expect(mocks.login).toHaveBeenCalledWith('jo@accelit.com.au', 'secret-pass');
        expect(mocks.routePostAuth).toHaveBeenCalledWith({ token: 'app-token' }, 'jo@accelit.com.au');
    });
});
