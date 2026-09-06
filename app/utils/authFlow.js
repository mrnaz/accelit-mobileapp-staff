import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import api from '../services/api';
import { STORAGE_KEYS, ALL_AUTH_KEYS } from '../constants/storageKeys';

export async function persistAuth(token, deviceToken) {
    await AsyncStorage.setItem(STORAGE_KEYS.token, token);
    api.setToken(token);

    if (deviceToken) {
        await AsyncStorage.setItem(STORAGE_KEYS.mfaDeviceToken, deviceToken);
        api.setDeviceToken(deviceToken);
    }
}

export async function clearAuth() {
    await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
    api.setToken(null);
    api.setDeviceToken(null);
}

// A login response is one of two shapes: a full token, or an OTP stub plus the
// MFA details needed to prompt for a code.
export async function routePostAuth(response) {
    if (response?.token) {
        await persistAuth(response.token, response.device_token);
        router.replace('/(main)');

        return;
    }

    if (response?.otpToken) {
        // The stub authenticates the OTP exchange and nothing else — it carries
        // the 'otp' ability, so every other endpoint rejects it with a 403.
        api.setToken(response.otpToken);

        router.push({
            pathname: '/(auth)/otp',
            params: {
                mfaType: response.mfaType ?? '',
                maskedMFA: response.maskedMFA ?? '',
                availableMethods: JSON.stringify(response.availableMethods ?? []),
            },
        });
    }
}
