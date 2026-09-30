export const STORAGE_KEYS = {
    // Pre-1.1.0 home of the full token. Task 7 removes this alias; until then
    // api.js still reads it.
    token: 'authToken',
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

// Everything cleared on logout and on any 401.
export const ALL_AUTH_KEYS = [STORAGE_KEYS.token, STORAGE_KEYS.mfaDeviceToken];

export default STORAGE_KEYS;
