import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const STAFF_CACHE_KEY = 'staffProfile';

const StaffContext = createContext(null);

// GET /api/me is the source of truth for what this staff member can see:
// sysadmin, client_access_*, ticket_access, permission_addressbook and
// permission_assetlist. Almost every gate in the backend is `$user->sysadmin`,
// so the app reads those flags rather than the `abilities` list.
//
// Mounted once at the root, above the auth screens, so `enabled` is what says
// "there is a session to describe". While it is off the provider holds nothing
// and fetches nothing; when it turns off again (sign out, or the api client's
// 401 handling) the last session's profile is dropped so the next sign-in
// cannot briefly show someone else's name.
export function StaffProvider({ enabled = true, children }) {
    const [staff, setStaff] = useState(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(null);

    // Bumped every time `enabled` changes. A fetch started under an earlier
    // session must not land after the session ended — it would repopulate a
    // profile and a cache that were just cleared.
    const session = useRef(0);

    const load = useCallback(async ({ useCache = true } = {}) => {
        const mine = session.current;
        const current = () => mine === session.current;

        setError(null);

        if (useCache) {
            try {
                const cached = await AsyncStorage.getItem(STAFF_CACHE_KEY);

                if (cached && current()) setStaff(JSON.parse(cached));
            } catch {
                // A bad cache entry is not worth failing over — the fetch below
                // is the real source anyway.
            }
        }

        try {
            const me = await api.me();

            if (!current()) return;

            // Never persist the TOTP seed /api/me returns for the user's own
            // account. The app has no use for it and a cache is the last place
            // it should live.
            const { mfa_totp_secret: _seed, ...safe } = me || {};

            setStaff(safe);
            await AsyncStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(safe));
        } catch (err) {
            // A 401 is already handled globally by the api client, which wipes
            // the token and routes to login.
            if (current() && err.status !== 401) setError(err.message);
        } finally {
            if (current()) setLoading(false);
        }
    }, []);

    useEffect(() => {
        session.current += 1;

        if (!enabled) {
            setStaff(null);
            setError(null);
            setLoading(false);

            return;
        }

        setLoading(true);
        load();
    }, [enabled, load]);

    const value = useMemo(
        () => ({ staff, loading, error, reload: () => load({ useCache: false }) }),
        [staff, loading, error, load],
    );

    return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

export function useStaff() {
    const ctx = useContext(StaffContext);

    if (!ctx) throw new Error('useStaff must be used inside a StaffProvider');

    return ctx;
}

export async function clearStaffCache() {
    await AsyncStorage.removeItem(STAFF_CACHE_KEY);
}

export default { StaffProvider, useStaff, clearStaffCache };
