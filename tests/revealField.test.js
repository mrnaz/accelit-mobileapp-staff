/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Passwords are displayed and then discarded: never copied to the clipboard,
// never selectable, and hidden again the moment the app leaves the
// foreground so they are not in the app-switcher snapshot.
const mocks = vi.hoisted(() => ({ appStateListeners: [], setStringAsync: vi.fn() }));

vi.mock('react-native', async () => {
    const R = await import('react');
    const el = (tag, map = () => ({})) => ({ children, ...props }) => R.createElement(tag, map(props), children);

    return {
        View: el('div'),
        Text: el('span', (p) => ({ 'data-selectable': String(!!p.selectable), 'data-lines': p.numberOfLines })),
        TouchableOpacity: el('button', (p) => ({
            onClick: p.onPress, disabled: p.disabled, 'aria-label': p.accessibilityLabel,
        })),
        ActivityIndicator: el('span'),
        Platform: { OS: 'ios' },
        StyleSheet: { create: (s) => s, flatten: (s) => s },
        AppState: {
            currentState: 'active',
            addEventListener: (_type, fn) => {
                mocks.appStateListeners.push(fn);

                return { remove: () => mocks.appStateListeners.splice(mocks.appStateListeners.indexOf(fn), 1) };
            },
        },
    };
});

vi.mock('@expo/vector-icons', async () => {
    const R = await import('react');

    return { Ionicons: ({ name }) => R.createElement('span', { 'data-icon': name }) };
});

vi.mock('expo-clipboard', () => ({ setStringAsync: mocks.setStringAsync }));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));

import RevealField from '../app/components/RevealField';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const mount = async () => {
    await act(async () => { root.render(React.createElement(RevealField, { label: 'Password', value: 'Str0ngP@ss!' })); });
};

const tap = async (label) => {
    const button = container.querySelector(`button[aria-label="${label}"]`);

    expect(button, `button "${label}"`).not.toBeNull();
    await act(async () => { button.click(); });
};

// The value is the one Text with numberOfLines; the label has none.
const valueText = () => container.querySelector('span[data-lines]');

beforeEach(() => {
    mocks.appStateListeners.length = 0;
    mocks.setStringAsync.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
});

describe('RevealField', () => {
    it('shows the value on tap and offers no way to copy it', async () => {
        await mount();
        expect(valueText().textContent).not.toContain('Str0ngP@ss!');

        await tap('Show Password');

        expect(valueText().textContent).toBe('Str0ngP@ss!');
        expect(container.querySelector('button[aria-label="Copy Password"]')).toBeNull();
        expect(mocks.setStringAsync).not.toHaveBeenCalled();
    });

    it('never makes the revealed value selectable', async () => {
        await mount();
        await tap('Show Password');

        expect(valueText().getAttribute('data-selectable')).toBe('false');
    });

    it('hides the value again when the app leaves the foreground', async () => {
        await mount();
        await tap('Show Password');
        expect(valueText().textContent).toBe('Str0ngP@ss!');
        expect(mocks.appStateListeners.length).toBeGreaterThan(0);

        await act(async () => { mocks.appStateListeners.forEach((fn) => fn('background')); });

        expect(valueText().textContent).not.toContain('Str0ngP@ss!');
    });
});
