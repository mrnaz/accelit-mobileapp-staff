// Pure rules for the biometric session. No React and no native modules, so
// every decision about locking and routing can be tested in node.

export const LOCK_AFTER_MS = 5 * 60 * 1000;

// expo-local-authentication's AuthenticationType values.
const FINGERPRINT = 1;
const FACIAL_RECOGNITION = 2;

// `backgroundedAt` is only ever set on AppState 'background', never on
// 'inactive': iOS goes inactive for the Face ID sheet itself, and counting
// that would lock the app in the middle of unlocking it.
export function shouldLock(backgroundedAt, now) {
    return backgroundedAt != null && now - backgroundedAt >= LOCK_AFTER_MS;
}

// A marker without a readable expiry counts as live. The server's 401 ends a
// session it has already expired, so erring this way costs one biometric
// prompt; erring the other way would throw a live session away.
export function isExpired(marker, now) {
    const at = Date.parse(marker?.expiresAt ?? '');

    return Number.isFinite(at) && at <= now;
}

// Where the root layout sends someone, or null to leave them where they are.
// Auth screens are always left alone: "Sign in with password" takes a locked
// session to the login screen on purpose, and the code step runs with no
// session at all.
export function routeFor({ status, inAuthGroup }) {
    if (status === 'unlocked' || inAuthGroup) return null;
    if (status === 'locked') return '/(auth)/unlock';
    if (status === 'expired') return '/(auth)/login?reason=expired';

    return '/(auth)/login';
}

// A biometric-bound SecureStore read that throws either was cancelled —
// Android says "User canceled the authentication", iOS "User canceled the
// operation." — or failed for another reason (lockout, hardware). The third
// outcome, null for an item the OS invalidated, is the caller's to handle.
export function classifyUnlockFailure(error) {
    return /cancel/i.test(error?.message ?? '') ? 'cancelled' : 'failed';
}

export function unlockLabel(os, types = []) {
    const face = types.includes(FACIAL_RECOGNITION);
    const finger = types.includes(FINGERPRINT);

    if (os === 'ios') {
        if (face) return 'Face ID';
        if (finger) return 'Touch ID';

        return 'biometrics';
    }

    if (finger) return 'fingerprint';
    if (face) return 'face unlock';

    return 'biometrics';
}

export function reasonMessage(reason, label) {
    if (reason === 'expired') return 'Your session expired — sign in again.';

    if (reason === 'changed') {
        const name = label.charAt(0).toUpperCase() + label.slice(1);

        return `${name} changed on this phone — sign in with your password.`;
    }

    return null;
}
