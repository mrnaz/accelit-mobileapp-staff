import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { STORAGE_KEYS, SECURE_SESSION_KEY } from '../constants/storageKeys';
import { onSessionEnded } from '../utils/contactSync';
import { isExpired, classifyUnlockFailure, unlockLabel } from '../utils/sessionRules';

// The one holder of the staff_app token. While unlocked it sits in memory
// here. At rest on a phone it sits in the Keychain / Keystore with
// requireAuthentication, so the OS hands it back only after a Face ID or
// fingerprint match: the biometric check is the OS's, not ours. A phone with
// no biometric enrolled never stores it, and signs in with the password.
//
// The same options go on every call. On iOS they pick the keychain entry, and
// an entry written with requireAuthentication is not found by a call without.
const SECURE_OPTIONS = { requireAuthentication: true, authenticationPrompt: 'Unlock Accel Staff' };

const isWeb = Platform.OS === 'web';

let token = null;
let migration = null;

export const currentToken = () => token;

// Android: BIOMETRIC_STRONG enrolled. iOS: biometrics enrolled and the Face ID
// permission not refused. Exactly what a biometric-bound write needs.
export function biometricsUsable() {
    if (isWeb) return false;

    try {
        return SecureStore.canUseBiometricAuthentication();
    } catch (error) {
        console.warn('session: biometric check failed', error);

        return false;
    }
}

async function clearStored() {
    await AsyncStorage.multiRemove([STORAGE_KEYS.sessionMarker, STORAGE_KEYS.webToken]);

    if (isWeb) return;

    try {
        await SecureStore.deleteItemAsync(SECURE_SESSION_KEY, SECURE_OPTIONS);
    } catch (error) {
        console.warn('session: could not delete the stored token', error);
    }
}

// A full sign-in. Resolves true when the session will survive the app closing.
export async function start({ token: fresh, expires_at: expiresAt } = {}, email) {
    token = fresh;

    if (email) await AsyncStorage.setItem(STORAGE_KEYS.lastEmail, email);

    if (isWeb) {
        await AsyncStorage.setItem(STORAGE_KEYS.webToken, fresh);

        return true;
    }

    // Whatever is stored belongs to an older session. It goes first, so a
    // write refused below cannot leave a marker pointing at nothing.
    await clearStored();

    if (!biometricsUsable()) return false;

    try {
        // Android asks for a fingerprint to write this; iOS asks only to read.
        await SecureStore.setItemAsync(SECURE_SESSION_KEY, fresh, SECURE_OPTIONS);
    } catch (error) {
        // Cancelled, or the Keystore refused. This run carries on; the next
        // open is a password sign-in.
        console.warn('session: could not store the token', error);

        return false;
    }

    await AsyncStorage.setItem(STORAGE_KEYS.sessionMarker, JSON.stringify({ expiresAt: expiresAt ?? null }));

    return true;
}

// Reading the token back is the biometric prompt.
export async function unlock() {
    let stored;

    try {
        stored = await SecureStore.getItemAsync(SECURE_SESSION_KEY, SECURE_OPTIONS);
    } catch (error) {
        return classifyUnlockFailure(error);
    }

    // SecureStore answers null for an item the OS has invalidated: a face or
    // fingerprint was added or removed since it was written.
    if (!stored) {
        await clearStored();

        return 'changed';
    }

    token = stored;

    return 'unlocked';
}

export function lock() {
    token = null;
}

export async function end() {
    token = null;
    await clearStored();
}

async function readMarker() {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.sessionMarker);

    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

// Builds before 1.1.0 kept the full token in plain AsyncStorage and gave the
// contact worker a copy. Both go, the first time this build asks. A failure is
// logged and counts as done for this run: status() must always answer, and a
// leftover token is a dead one by now that the next launch tries to clear again.
function migrateLegacy() {
    if (!migration) {
        migration = (async () => {
            try {
                if (!(await AsyncStorage.getItem(STORAGE_KEYS.legacyToken))) return;

                await AsyncStorage.removeItem(STORAGE_KEYS.legacyToken);
                await onSessionEnded({ explicit: false });
            } catch (error) {
                console.warn('session: could not clear the pre-1.1.0 token', error);
            }
        })();
    }

    return migration;
}

// 'expired' is reported once: the session is cleared as it is reported, so the
// sign-in screen can say why and the next check says 'none'.
export async function status(now = Date.now()) {
    await migrateLegacy();

    if (token) return 'unlocked';

    if (isWeb) {
        token = await AsyncStorage.getItem(STORAGE_KEYS.webToken);

        return token ? 'unlocked' : 'none';
    }

    const marker = await readMarker();

    if (!marker) return 'none';

    if (isExpired(marker, now)) {
        await clearStored();

        return 'expired';
    }

    // Biometrics removed, or the Face ID permission withdrawn: the stored token
    // can never be read again, so don't offer a prompt that cannot succeed.
    if (!biometricsUsable()) {
        await clearStored();

        return 'none';
    }

    return 'locked';
}

export async function lastEmail() {
    return (await AsyncStorage.getItem(STORAGE_KEYS.lastEmail)) || '';
}

export async function label() {
    try {
        return unlockLabel(Platform.OS, await LocalAuthentication.supportedAuthenticationTypesAsync());
    } catch (error) {
        console.warn('session: could not read the biometric types', error);

        return unlockLabel(Platform.OS, []);
    }
}
