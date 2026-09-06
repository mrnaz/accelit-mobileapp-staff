import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Theme from '../context/ThemeContext';

// The loading / error / empty triad, extracted once. The reference app
// copy-pastes it across 26 screens with byte-identical style blocks.
// Renders null when there is nothing to say, so a screen can drop it in above
// its list without branching.
export default function ScreenState({
    loading,
    error,
    empty,
    emptyText = 'Nothing here',
    emptyIcon,
    emptyTint,
    onRetry,
}) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Ionicons name="alert-circle-outline" size={28} color={colors.textSecondary} />
                <Text style={[styles.message, { color: colors.textSecondary }]}>{error}</Text>
                {onRetry ? (
                    <TouchableOpacity
                        onPress={onRetry}
                        style={[styles.retry, { borderColor: colors.border }]}
                    >
                        <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Retry</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        );
    }

    if (empty) {
        return (
            <View style={styles.center}>
                {emptyIcon ? (
                    <Ionicons name={emptyIcon} size={28} color={emptyTint || colors.textSecondary} />
                ) : null}
                <Text style={[styles.message, { color: colors.textSecondary }]}>{emptyText}</Text>
            </View>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
    message: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
    retry: {
        borderWidth: 1, borderRadius: 10,
        paddingHorizontal: 16, paddingVertical: 8, marginTop: 4,
    },
});
