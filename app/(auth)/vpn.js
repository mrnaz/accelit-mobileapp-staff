import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import api from '../services/api';
import t from '../constants/authTheme';

const RECHECK_SECONDS = 5;

export default function VpnScreen() {
    const [checking, setChecking] = useState(false);
    const [stillBlocked, setStillBlocked] = useState(false);
    const [seconds, setSeconds] = useState(RECHECK_SECONDS);
    // The tick reads the countdown from here rather than from a state
    // updater: an updater has to be pure, and React may run it more than once
    // for the same tick — which would fire a second check.
    const secondsRef = useRef(RECHECK_SECONDS);
    const timerRef = useRef(null);
    const inFlight = useRef(false);
    const mounted = useRef(true);

    const recheck = useCallback(async () => {
        // The countdown and the "Try now" button both land here. Without this
        // guard a slow check still in flight when the next tick fires (or a
        // tap lands mid-check) would race a second ipCheck() against it, and
        // an out-of-order response could stomp a newer result with a stale one.
        if (inFlight.current) return;

        inFlight.current = true;
        setChecking(true);
        setStillBlocked(false);

        try {
            const { allowed } = await api.ipCheck();

            if (!mounted.current) return; // screen navigated away mid-check

            if (allowed) {
                if (timerRef.current) clearInterval(timerRef.current);
                router.replace('/(auth)/login');

                return;
            }

            setStillBlocked(true);
        } catch {
            // Still unreachable — the phone is off the network entirely rather
            // than on it from the wrong address. Same advice either way.
            if (mounted.current) setStillBlocked(true);
        } finally {
            inFlight.current = false;
            if (mounted.current) setChecking(false);
        }
    }, []);

    // Quietly keep asking in the background so a staff member who turns the
    // VPN on doesn't have to remember to come back and tap the button.
    useEffect(() => {
        mounted.current = true;

        timerRef.current = setInterval(() => {
            const next = secondsRef.current - 1;

            secondsRef.current = next > 0 ? next : RECHECK_SECONDS;
            setSeconds(secondsRef.current);

            if (next <= 0) recheck();
        }, 1000);

        return () => {
            mounted.current = false;
            clearInterval(timerRef.current);
        };
    }, [recheck]);

    return (
        <SafeAreaView style={styles.screen}>
            <StatusBar style="light" />

            <View style={styles.badge}>
                <Ionicons name="shield-outline" size={40} color={t.accent} />
            </View>

            <Text style={styles.title}>Connect to the office VPN</Text>
            <Text style={styles.body}>
                The staff app only works from the office network. Turn the VPN on — we'll notice and sign you in.
            </Text>

            <TouchableOpacity
                onPress={recheck}
                disabled={checking}
                style={[styles.button, checking && { opacity: 0.6 }]}
                accessibilityRole="button"
            >
                {checking
                    ? <ActivityIndicator color={t.onAccent} />
                    : <Text style={styles.buttonText}>Try now</Text>}
            </TouchableOpacity>

            <View style={styles.recheckRow}>
                <ActivityIndicator size="small" color={t.textSecondary} />
                <Text style={styles.recheckText}>
                    {checking ? 'Checking…' : `Checking again in ${seconds}s`}
                </Text>
            </View>

            <TouchableOpacity onPress={() => Linking.openSettings()} accessibilityRole="button">
                <Text style={styles.settingsLink}>Open VPN settings</Text>
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
    recheckRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    recheckText: { color: t.textSecondary, fontSize: 12 },
    settingsLink: { color: t.accent, fontSize: 13, fontWeight: '600', marginTop: 4 },
    hint: { color: t.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 2 },
});
