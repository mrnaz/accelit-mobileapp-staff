import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import api from '../services/api';
import t from '../constants/authTheme';

export default function VpnScreen() {
    const [checking, setChecking] = useState(false);
    const [stillBlocked, setStillBlocked] = useState(false);

    const recheck = useCallback(async () => {
        setChecking(true);
        setStillBlocked(false);

        try {
            const { allowed } = await api.ipCheck();

            if (allowed) {
                router.replace('/(auth)/login');

                return;
            }

            setStillBlocked(true);
        } catch {
            // Still unreachable — the phone is off the network entirely rather
            // than on it from the wrong address. Same advice either way.
            setStillBlocked(true);
        } finally {
            setChecking(false);
        }
    }, []);

    return (
        <SafeAreaView style={styles.screen}>
            <StatusBar style="light" />

            <View style={styles.badge}>
                <Ionicons name="shield-outline" size={40} color={t.accent} />
            </View>

            <Text style={styles.title}>Connect to the office VPN</Text>
            <Text style={styles.body}>
                The staff app only works from the office network. Turn the VPN on, then try again.
            </Text>

            <TouchableOpacity
                onPress={recheck}
                disabled={checking}
                style={[styles.button, checking && { opacity: 0.6 }]}
                accessibilityRole="button"
            >
                {checking
                    ? <ActivityIndicator color={t.onAccent} />
                    : <Text style={styles.buttonText}>Try again</Text>}
            </TouchableOpacity>

            {stillBlocked ? (
                <Text style={styles.hint}>Still not connected. Check the VPN is showing as active.</Text>
            ) : null}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: t.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 14,
    },
    badge: {
        width: 84, height: 84, borderRadius: 42,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: t.surface,
        borderWidth: 1, borderColor: t.border,
        marginBottom: 6,
    },
    title: { color: t.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center' },
    body: { color: t.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    button: {
        marginTop: 10,
        backgroundColor: t.accent,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 40,
        minWidth: 180,
        alignItems: 'center',
    },
    buttonText: { color: t.onAccent, fontSize: 15, fontWeight: '700' },
    hint: { color: t.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 2 },
});
