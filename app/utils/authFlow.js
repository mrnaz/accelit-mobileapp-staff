import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import api, { API_BASE_URL } from '../services/api';
import * as session from '../services/session';
import { onSessionStarted, onSessionEnded } from './contactSync';
import { STORAGE_KEYS, ALL_AUTH_KEYS } from '../constants/storageKeys';

// A full sign-in: the password (and the code, if asked) accepted and a
// staff_app token issued.
export async function completeSignIn(response, email) {
    api.setOtpToken(null);
    await session.start(response, email);

    // The worker runs with no biometric check, from plain app-private prefs,
    // so it gets the address-book-only token and never the full one.
    if (response.contacts_token) await onSessionStarted(response.contacts_token, API_BASE_URL);

    if (response.device_token) {
        await AsyncStorage.setItem(STORAGE_KEYS.mfaDeviceToken, response.device_token);
        api.setDeviceToken(response.device_token);
    }
}

// Back out of the code step. Only the stub goes: a locked session the user
// left through "Sign in with password" must still be there next time.
export function abandonOtp() {
    api.setOtpToken(null);
}

// Sign-out.
export async function clearAuth() {
    await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
    api.setOtpToken(null);
    api.setDeviceToken(null);
    await session.end();
    await onSessionEnded({ explicit: false });
}

// A login response is one of two shapes: a full token, or an OTP stub plus the
// MFA details needed to prompt for a code.
export async function routePostAuth(response, email) {
    if (response?.token) {
        await completeSignIn(response, email);
        router.replace('/(main)');

        return;
    }

    if (response?.otpToken) {
        // The stub authenticates the OTP exchange and nothing else — it carries
        // the 'otp' ability, so every other endpoint rejects it with a 403.
        api.setOtpToken(response.otpToken);

        router.push({
            pathname: '/(auth)/otp',
            params: {
                email: email ?? '',
                mfaType: response.mfaType ?? '',
                maskedMFA: response.maskedMFA ?? '',
                availableMethods: JSON.stringify(response.availableMethods ?? []),
            },
        });
    }
}
