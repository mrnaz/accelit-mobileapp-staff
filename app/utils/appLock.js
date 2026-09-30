import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import * as session from '../services/session';
import { routeFor, shouldLock } from './sessionRules';

// Remembers when the app went to the background. Coming back after
// LOCK_AFTER_MS, it drops the in-memory token and routes to unlock, or to
// sign-in on a phone with no stored session. Only 'background' starts the
// clock: iOS turns the app 'inactive' for its own Face ID sheet and for
// Control Centre.
export function createLockListener(clock = Date.now) {
    let backgroundedAt = null;

    return async function onAppStateChange(state) {
        if (state === 'background') {
            backgroundedAt = clock();

            return;
        }

        if (state !== 'active') return;

        const since = backgroundedAt;

        backgroundedAt = null;

        if (!session.currentToken() || !shouldLock(since, clock())) return;

        session.lock();

        const target = routeFor({ status: await session.status(), inAuthGroup: false });

        if (target) router.replace(target);
    };
}

// The web harness has no biometrics to come back through, so it never locks.
export default function useAppLock() {
    useEffect(() => {
        if (Platform.OS === 'web') return undefined;

        const subscription = AppState.addEventListener('change', createLockListener());

        return () => subscription.remove();
    }, []);
}
