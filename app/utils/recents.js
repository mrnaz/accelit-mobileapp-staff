import AsyncStorage from '@react-native-async-storage/async-storage';
import { bumpRecent } from './addressBook';

const KEY = 'addressBookRecents';

export async function loadRecents() {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
    } catch {
        return [];
    }
}

export async function rememberRecent(keys, key) {
    const next = bumpRecent(keys, key);

    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch { /* best effort */ }

    return next;
}
