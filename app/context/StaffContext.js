import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const STAFF_CACHE_KEY = 'staffProfile';

const StaffContext = createContext(null);

// GET /api/me is the source of truth for what this staff member can see:
// sysadmin, client_access_*, ticket_access, permission_addressbook and
// permission_assetlist. Almost every gate in the backend is `$user->sysadmin`,
// so the app reads those flags rather than the `abilities` list.
export function StaffProvider({ children }) {
    const [staff, setStaff] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async ({ useCache = true } = {}) => {
        setError(null);

        if (useCache) {
            try {
                const cached = await AsyncStorage.getItem(STAFF_CACHE_KEY);

                if (cached) setStaff(JSON.parse(cached));
            } catch {
                // A bad cache entry is not worth failing over — the fetch below
                // is the real source anyway.
            }
        }

        try {
            const me = await api.me();

            // Never persist the TOTP seed /api/me returns for the user's own
            // account. The app has no use for it and a cache is the last place
            // it should live.
            const { mfa_totp_secret: _seed, ...safe } = me || {};

            setStaff(safe);
            await AsyncStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(safe));
        } catch (err) {
            // A 401 is already handled globally by the api client, which wipes
            // the token and routes to login.
            if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

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
