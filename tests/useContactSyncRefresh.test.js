/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ listener: null, remove: vi.fn(), refreshIfStale: vi.fn(async () => false) }));

vi.mock('react-native', () => ({
    AppState: {
        addEventListener: (event, listener) => {
            mocks.listener = listener;

            return { remove: mocks.remove };
        },
    },
}));

vi.mock('../app/utils/contactSync', () => ({ refreshIfStale: mocks.refreshIfStale }));

import useContactSyncRefresh from '../app/utils/useContactSyncRefresh';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ active }) {
    useContactSyncRefresh(active);

    return null;
}

const render = async (root, active) => act(async () => { root.render(<Probe active={active} />); });

beforeEach(() => {
    mocks.listener = null;
    mocks.remove.mockClear();
    mocks.refreshIfStale.mockClear();
});

describe('useContactSyncRefresh', () => {
    it('stays silent until the user is signed in', async () => {
        const root = createRoot(document.createElement('div'));

        await render(root, false);

        expect(mocks.refreshIfStale).not.toHaveBeenCalled();
        expect(mocks.listener).toBeNull();
    });

    it('checks on sign-in and again each time the app comes forward', async () => {
        const root = createRoot(document.createElement('div'));

        await render(root, true);
        expect(mocks.refreshIfStale).toHaveBeenCalledTimes(1);

        mocks.listener('background');
        expect(mocks.refreshIfStale).toHaveBeenCalledTimes(1);

        mocks.listener('active');
        expect(mocks.refreshIfStale).toHaveBeenCalledTimes(2);

        await act(async () => { root.unmount(); });
        expect(mocks.remove).toHaveBeenCalledTimes(1);
    });
});
