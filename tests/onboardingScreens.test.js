/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The two Asset Onboarding screens, rendered for real. Parse-checking proves
// they compile; only a render proves the list still draws a row and that the
// deployment page puts its cards in the order the client asked for.
const mocks = vi.hoisted(() => ({ params: { id: '9001' }, assetOnboarding: vi.fn() }));

// `style` reaches these as an array of objects; flatten it so a test can ask
// what colour a piece of text actually ended up.
const colourOf = (style) => {
    const flat = [].concat(style || []).filter(Boolean);

    return flat.reduce((found, layer) => (layer && layer.color ? layer.color : found), undefined);
};

vi.mock('react-native', async () => {
    const R = await import('react');
    const el = (tag, map = () => ({})) => ({ children, ...props }) => R.createElement(tag, map(props), children);

    return {
        View: el('div'),
        Text: el('span', (p) => ({ 'data-color': colourOf(p.style) })),
        Image: el('img'),
        ScrollView: el('div'),
        TextInput: ({ value }) => R.createElement('input', { readOnly: true, value: value ?? '' }),
        TouchableOpacity: el('button', (p) => ({ onClick: p.onPress, 'aria-label': p.accessibilityLabel })),
        ActivityIndicator: el('span'),
        RefreshControl: () => null,
        Platform: { OS: 'ios' },
        Linking: { openURL: vi.fn() },
        StyleSheet: { create: (s) => s, flatten: (s) => Object.assign({}, ...[].concat(s || []).filter(Boolean)) },
        AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) },
        FlatList: ({ data, renderItem, keyExtractor, ListHeaderComponent, ListFooterComponent, ListEmptyComponent }) => {
            const part = (node) => (typeof node === 'function' ? R.createElement(node) : node);
            const rows = (data || []).map((item, index) =>
                R.createElement(R.Fragment, { key: keyExtractor ? keyExtractor(item, index) : index },
                    renderItem({ item, index })));

            return R.createElement('div', null,
                part(ListHeaderComponent),
                rows.length ? rows : part(ListEmptyComponent),
                part(ListFooterComponent));
        },
        // Nothing should reach for a SectionList any more: the group headings
        // are gone. Rendering one would blow up rather than pass quietly.
        SectionList: () => { throw new Error('SectionList is not used by these screens any more'); },
    };
});

vi.mock('@expo/vector-icons', async () => {
    const R = await import('react');
    const icon = (family) => ({ name }) => R.createElement('i', { 'data-icon': `${family}:${name}` });

    return { Ionicons: icon('ion'), FontAwesome: icon('fa') };
});

vi.mock('expo-router', () => ({
    router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => true },
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => true }),
    useNavigation: () => ({ canGoBack: () => true, goBack: vi.fn() }),
    useSegments: () => [],
    useLocalSearchParams: () => mocks.params,
}));

vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));

vi.mock('react-native-safe-area-context', async () => {
    const R = await import('react');

    return {
        SafeAreaView: ({ children }) => R.createElement('div', null, children),
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
        multiGet: async (keys) => keys.map((k) => [k, null]),
        multiRemove: async () => {},
    },
}));

vi.mock('../app/services/api', () => ({ default: { assetOnboarding: mocks.assetOnboarding } }));

import Onboarding from '../app/(main)/onboarding';
import OnboardingRecord from '../app/onboarding/[id]';
import { lightColors } from '../app/constants/theme';

const RECORDS = [
    {
        id: 9001,
        computername: 'ACC-LT-0142',
        prev_computername: 'OLD-PC',
        client_name: 'Accolade Screens',
        label_code: 'SRV',
        username: 'localadmin',
        localadmin_pw: 'Str0ngP@ss!',
        created_at: '2026-01-12 13:37:00',
    },
    {
        id: 9002,
        computername: 'DRA-WS-0007',
        prev_computername: null,
        client_name: 'Drainpro',
        label_code: 'WKS',
        username: 'localadmin',
        localadmin_pw: 'An0ther!',
        created_at: '2026-09-02 15:27:00',
    },
];

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const mount = async (Screen) => {
    await act(async () => { root.render(React.createElement(Screen)); });
    // fetch → setState, plus the theme's stored-mode read.
    for (let i = 0; i < 3; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    }
};

const text = () => container.textContent;

beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = { id: '9001' };
    mocks.assetOnboarding.mockResolvedValue({ assets: RECORDS });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
});

describe('Asset Onboarding list', () => {
    it('lists every machine with no per-client group heading', async () => {
        await mount(Onboarding);

        expect(text()).toContain('ACC-LT-0142');
        expect(text()).toContain('DRA-WS-0007');
        // The client's name was the group heading. Now only its avatar says
        // who the machine belongs to.
        expect(text()).not.toContain('Accolade Screens');
        expect(text()).not.toContain('Drainpro');
    });

    it('gives each row the client avatar', async () => {
        await mount(Onboarding);

        expect(text()).toContain('AS');
        // A laptop glyph stood here before the avatar did.
        expect(container.querySelector('[data-icon="ion:laptop-outline"]')).toBeNull();
    });

    it('drops the old computer name from the row', async () => {
        await mount(Onboarding);

        expect(text()).not.toContain('was OLD-PC');
        expect(text()).not.toContain('OLD-PC');
    });

    it('stamps each row with the day and the time', async () => {
        await mount(Onboarding);

        expect(text()).toContain('Mon, 12 Jan 2026 @ 1:37pm');
        expect(text()).toContain('Wed, 2 Sep 2026 @ 3:27pm');
    });
});

describe('Asset Onboarding deployment page', () => {
    it('puts the machine card above the local administrator card', async () => {
        await mount(OnboardingRecord);

        expect(text().indexOf('Machine')).toBeGreaterThan(-1);
        expect(text().indexOf('Machine')).toBeLessThan(text().indexOf('Local administrator'));
    });

    it('uses the list page date format', async () => {
        await mount(OnboardingRecord);

        expect(text()).toContain('Mon, 12 Jan 2026 @ 1:37pm');
    });

    it('shows the bare label in the brand blue, without the word Label', async () => {
        await mount(OnboardingRecord);

        expect(text()).not.toContain('Label SRV');

        const label = [...container.querySelectorAll('span')].find((n) => n.textContent === 'SRV');

        expect(label).toBeTruthy();
        expect(label.getAttribute('data-color')).toBe(lightColors.primary);
    });
});
