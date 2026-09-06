export const STORAGE_KEYS = {
    // The full-ability Sanctum token. Expires 600 minutes after it was minted,
    // with no refresh mechanism anywhere in the backend, so a daily re-login is
    // expected rather than a bug.
    token: 'authToken',
    // 64-char device token from check-otp's remember_device. Suppresses MFA for
    // three weeks. Sent back as the X-MFA-Device-Token header.
    mfaDeviceToken: 'mfaDeviceToken',
    themeMode: 'themeMode',
};

// Everything cleared on logout and on any 401.
export const ALL_AUTH_KEYS = [STORAGE_KEYS.token, STORAGE_KEYS.mfaDeviceToken];

export default STORAGE_KEYS;
