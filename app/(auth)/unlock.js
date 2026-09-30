import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as session from '../services/session';
import t from '../constants/authTheme';

const FAILED = "Couldn't unlock. Try again, or sign in with your password.";

export default function UnlockScreen() {
    const [email, setEmail] = useState('');
    const [label, setLabel] = useState('biometrics');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    // One prompt at a time: Android refuses a second read while the first
    // prompt is up, and that refusal would read as a failed unlock.
    const inFlight = useRef(false);
    const prompted = useRef(false);

    const attempt = useCallback(async () => {
        if (inFlight.current) return;

        inFlight.current = true;
        setBusy(true);
        setError(null);

        // A throw must not strand the spinner with a dead button: the prompt is
        // over either way, so count it as a failed unlock and let them retry.
        let result;
        try {
            result = await session.unlock();
        } catch (error) {
            console.warn('unlock: could not read the session', error);
            result = 'failed';
        }

        inFlight.current = false;
        setBusy(false);

        if (result === 'unlocked') {
            router.replace('/(main)');
        } else if (result === 'changed') {
            router.replace('/(auth)/login?reason=changed');
        } else if (result === 'failed') {
            setError(FAILED);
        }
        // 'cancelled': they closed the prompt on purpose. The button stays.
    }, []);

    useEffect(() => {
        (async () => {
            setEmail(await session.lastEmail());
            setLabel(await session.label());
        })();

        // Ask straight away rather than making them tap first. The ref, not the
        // effect, decides: StrictMode runs this effect twice.
        if (!prompted.current) {
            prompted.current = true;
            attempt();
        }
    }, [attempt]);

    return (
        <SafeAreaView style={styles.screen}>
            <StatusBar style="light" />
            <View style={styles.body}>
                <Image
                    source={require('../../assets/icon.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.title}>Accel Staff</Text>
                {email ? <Text style={styles.subtitle}>{email}</Text> : null}

                <TouchableOpacity
                    onPress={attempt}
                    disabled={busy}
                    style={[styles.button, busy && { opacity: 0.6 }]}
                    accessibilityRole="button"
                >
                    {busy
                        ? <ActivityIndicator color={t.onAccent} />
                        : <Text style={styles.buttonText}>{`Unlock with ${label}`}</Text>}
                </TouchableOpacity>

                {error ? (
                    <View style={styles.errorRow}>
                        <Ionicons name="alert-circle-outline" size={16} color={t.error} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <TouchableOpacity onPress={() => router.push('/(auth)/login')} accessibilityRole="button">
                    <Text style={styles.link}>Sign in with password</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    logo: { width: 140, height: 46, alignSelf: 'center', marginBottom: 18 },
    title: { color: t.textPrimary, fontSize: 22, fontWeight: '700', textAlign: 'center' },
    subtitle: { color: t.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4 },
    button: {
        marginTop: 28,
        backgroundColor: t.accent,
        borderRadius: 12, paddingVertical: 14,
        alignItems: 'center',
    },
    buttonText: { color: t.onAccent, fontSize: 15, fontWeight: '700' },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    errorText: { color: t.error, fontSize: 13, flex: 1 },
    link: { color: t.accent, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 22 },
});
