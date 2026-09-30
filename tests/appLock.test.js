import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    token: 'app-token',
    status: 'locked',
    now: 0,
    lock: vi.fn(),
    replace: vi.fn(),
}));

vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() }, Platform: { OS: 'ios' } }));
vi.mock('expo-router', () => ({ router: { replace: mocks.replace } }));
vi.mock('../app/services/session', () => ({
    currentToken: () => mocks.token,
    lock: () => { mocks.lock(); mocks.token = null; },
    status: async () => mocks.status,
}));

import { createLockListener } from '../app/utils/appLock';
import { LOCK_AFTER_MS } from '../app/utils/sessionRules';

let onChange;

const at = (ms) => { mocks.now = ms; };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.token = 'app-token';
    mocks.status = 'locked';
    mocks.now = 0;
    onChange = createLockListener(() => mocks.now);
});

describe('app lock', () => {
    it('locks after five minutes in the background and asks for biometrics', async () => {
        await onChange('background');
        at(LOCK_AFTER_MS);
        await onChange('active');

        expect(mocks.lock).toHaveBeenCalledTimes(1);
        expect(mocks.replace).toHaveBeenCalledWith('/(auth)/unlock');
    });

    it('does not lock after a quick switch away', async () => {
        await onChange('background');
        at(LOCK_AFTER_MS - 1);
        await onChange('active');

        expect(mocks.lock).not.toHaveBeenCalled();
        expect(mocks.replace).not.toHaveBeenCalled();
    });

    // iOS turns the app inactive for its own Face ID sheet. Counting that as
    // time away would lock the app in the middle of unlocking it.
    it('never counts inactive as time away', async () => {
        await onChange('inactive');
        at(LOCK_AFTER_MS * 10);
        await onChange('active');

        expect(mocks.lock).not.toHaveBeenCalled();
    });

    it('sends a phone with no stored session to sign-in', async () => {
        mocks.status = 'none';

        await onChange('background');
        at(LOCK_AFTER_MS);
        await onChange('active');

        expect(mocks.replace).toHaveBeenCalledWith('/(auth)/login');
    });

    it('leaves a signed-out or mid-code app alone', async () => {
        mocks.token = null;

        await onChange('background');
        at(LOCK_AFTER_MS);
        await onChange('active');

        expect(mocks.lock).not.toHaveBeenCalled();
        expect(mocks.replace).not.toHaveBeenCalled();
    });

    it('starts the clock afresh on every trip away', async () => {
        await onChange('background');
        at(1000);
        await onChange('active');
        at(LOCK_AFTER_MS * 2);
        await onChange('active');

        expect(mocks.lock).not.toHaveBeenCalled();
    });
});
