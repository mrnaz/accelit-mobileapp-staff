export const STORAGE_KEYS = {
    // 64-char device token from check-otp's remember_device. Suppresses MFA for
    // three weeks. Sent back as the X-MFA-Device-Token header.
    mfaDeviceToken: 'mfaDeviceToken',
    // {expiresAt} for the stored session. Says a biometric-locked session
    // exists without reading it, because reading it is what raises the Face ID
    // or fingerprint prompt. Holds nothing secret.
    sessionMarker: 'sessionMarker',
    // The email of the last successful full sign-in, to prefill the login form.
    // Survives sign-out: remembering the username is the point.
    lastEmail: 'lastEmail',
    // Web only (the Chrome dev harness): the session token. The web has no
    // secure store and no biometrics, so it keeps the pre-1.1.0 behaviour.
    webToken: 'webSessionToken',
    // Before 1.1.0 the full token sat here in plain AsyncStorage. Read only to
    // delete it (session.js).
    legacyToken: 'authToken',
    themeMode: 'themeMode',
};

// SecureStore key for the staff_app token (session.js). Written with
// requireAuthentication, so only a biometric match reads it back.
export const SECURE_SESSION_KEY = 'staffAppSession';

// Cleared on sign-out and on a 401 of a request that carried a token.
export const ALL_AUTH_KEYS = [STORAGE_KEYS.mfaDeviceToken];

export default STORAGE_KEYS;
