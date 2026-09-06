import React, { useCallback, useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../context/ThemeContext';
import api from '../services/api';
import { clearAuth } from '../utils/authFlow';
import { clearStaffCache } from '../context/StaffContext';

export default function LogoutButton({ onDone }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;
    const [busy, setBusy] = useState(false);

    const logout = useCallback(async () => {
        setBusy(true);

        try {
            await api.logout();
        } catch {
            // The token may already be dead. Clearing the device is what
            // matters, so a failed round trip should not strand the user.
        }

        await clearAuth();
        await clearStaffCache();

        onDone?.();
        router.replace('/(auth)/login');
    }, [onDone]);

    return (
        <TouchableOpacity
            onPress={logout}
            disabled={busy}
            style={[styles.button, { borderColor: colors.border }]}
            accessibilityRole="button"
        >
            {busy ? (
                <ActivityIndicator size="small" color={colors.error} />
            ) : (
                <Ionicons name="log-out-outline" size={16} color={colors.error} />
            )}
            <Text style={[styles.label, { color: colors.error }]}>Sign out</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row', alignItems: 'center', gap: 7,
        borderWidth: 1, borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 9,
    },
    label: { fontSize: 13, fontWeight: '600' },
});
