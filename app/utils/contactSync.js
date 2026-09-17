import { PermissionsAndroid } from 'react-native';
import contacts, { OFF_STATUS } from '../../modules/accel-contacts';

// Device-contact integration is a convenience. Nothing in here is allowed to
// break login, logout or a screen, so every call into native is contained.
export const STALE_MS = 60 * 60 * 1000;

const ERROR_TEXT = {
    permission: 'Contacts permission was turned off.',
    auth: 'Sign in again to keep contacts up to date.',
    network: 'Could not reach the server. Will retry.',
    http: 'Could not reach the server. Will retry.',
    malformed: 'Last sync failed. Will retry.',
    provider: 'Last sync failed. Will retry.',
};

// restore() runs on every navigation; native only needs telling when the
// token actually changes.
let pushedToken = null;

async function quietly(label, work) {
    try {
        return await work();
    } catch (error) {
        console.warn(`contact sync: ${label} failed`, error);

        return undefined;
    }
}

export const isSupported = () => contacts.isSupported();

export const errorText = (lastError) => (lastError ? ERROR_TEXT[lastError] || ERROR_TEXT.provider : null);

export async function getStatus() {
    return (await quietly('status', () => contacts.getStatus())) ?? OFF_STATUS;
}

export async function turnOn() {
    if (!contacts.isSupported()) return { ok: false, reason: 'unsupported' };

    const { PERMISSIONS, RESULTS } = PermissionsAndroid;
    const wanted = [PERMISSIONS.READ_CONTACTS, PERMISSIONS.WRITE_CONTACTS];

    try {
        const answers = await PermissionsAndroid.requestMultiple(wanted);
        const results = wanted.map((permission) => answers[permission]);

        if (results.some((result) => result === RESULTS.NEVER_ASK_AGAIN)) return { ok: false, reason: 'blocked' };
        if (results.some((result) => result !== RESULTS.GRANTED)) return { ok: false, reason: 'denied' };

        await contacts.enable();

        return { ok: true };
    } catch (error) {
        console.warn('contact sync: enable failed', error);

        return { ok: false, reason: 'error' };
    }
}

export async function turnOff() {
    await quietly('disable', () => contacts.disable());
}

export async function requestSync() {
    await quietly('sync', () => contacts.syncNow());
}

export async function refreshIfStale(now = Date.now()) {
    const status = await getStatus();

    if (!status.enabled) return false;

    const fresh = status.lastSuccessAt && now - status.lastSuccessAt < STALE_MS;

    if (fresh && !status.lastError) return false;

    await requestSync();

    return true;
}

export async function onSessionStarted(token, baseUrl) {
    if (!contacts.isSupported() || !token || token === pushedToken) return;

    const pushed = await quietly('session', async () => {
        await contacts.setSession(token, baseUrl);

        return true;
    });

    if (!pushed) return;

    pushedToken = token;
    await refreshIfStale();
}

// explicit: the user signed out, so the directory leaves the phone with them.
// Otherwise the session merely expired: the worker loses its token, the
// contacts stay, and the next login picks the sync back up.
export async function onSessionEnded({ explicit = false } = {}) {
    pushedToken = null;

    if (explicit) await quietly('disable', () => contacts.disable());

    await quietly('clear session', () => contacts.clearSession());
}
