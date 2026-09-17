import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// Android only, and only in a build that contains the native module. In Expo
// Go, on iOS and on web every call below resolves without doing anything, so
// callers never need a platform check of their own.
const native = Platform.OS === 'android' ? requireOptionalNativeModule('AccelContacts') : null;

export const OFF_STATUS = {
    enabled: false,
    hasPermission: false,
    accountExists: false,
    lastSuccessAt: null,
    lastError: null,
};

export default {
    isSupported: () => !!native,
    setSession: async (token, baseUrl) => { if (native) await native.setSession(token, baseUrl); },
    clearSession: async () => { if (native) await native.clearSession(); },
    enable: async () => { if (native) await native.enable(); },
    disable: async () => { if (native) await native.disable(); },
    syncNow: async () => { if (native) await native.syncNow(); },
    getStatus: async () => (native ? native.getStatus() : OFF_STATUS),
};
