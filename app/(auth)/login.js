import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ActivityIndicator,
    StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import api from '../services/api';
import { routePostAuth } from '../utils/authFlow';
import { isIpRefusal } from '../utils/apiErrors';
import t from '../constants/authTheme';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [gateChecked, setGateChecked] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Ask before offering a password box that cannot succeed. The web login
    // page does the same thing with this endpoint, which is reachable from any
    // address precisely so it can answer this question.
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                await api.restore();

                const { allowed } = await api.ipCheck();

                if (cancelled) return;

                if (!allowed) {
                    router.replace('/(auth)/vpn');

                    return;
                }
            } catch {
                // The check itself failed. Let the user try to log in rather
                // than stranding them on a VPN screen that may be wrong.
            }

            if (!cancelled) setGateChecked(true);
        })();

        return () => { cancelled = true; };
    }, []);

    const submit = useCallback(async () => {
        if (busy) return;

        setBusy(true);
        setError(null);

        try {
            const response = await api.login(email.trim(), password);

            await routePostAuth(response);
        } catch (err) {
            if (err.status === 403 && isIpRefusal(err.body)) return; // routed to /vpn

            setError(err.message);
        } finally {
            setBusy(false);
        }
    }, [busy, email, password]);

    if (!gateChecked) {
        return (
            <SafeAreaView style={[styles.screen, styles.centered]}>
                <StatusBar style="light" />
                <ActivityIndicator color={t.accent} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen}>
            <StatusBar style="light" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                >
                    <Image
                        source={require('../../assets/icon.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text style={styles.title}>Accel Staff</Text>
                    <Text style={styles.subtitle}>Sign in with your Accel Online account</Text>

                    <View style={styles.card}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            style={styles.input}
                            placeholder="you@accelit.com.au"
                            placeholderTextColor={t.textSecondary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            textContentType="username"
                            editable={!busy}
                        />

                        <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
                        <View style={[styles.input, styles.passwordRow]}>
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                style={styles.passwordInput}
                                placeholder="••••••••"
                                placeholderTextColor={t.textSecondary}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                textContentType="password"
                                editable={!busy}
                                onSubmitEditing={submit}
                                returnKeyType="go"
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword((v) => !v)}
                                accessibilityRole="button"
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={18}
                                    color={t.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>

                        {error ? (
                            <View style={styles.errorRow}>
                                <Ionicons name="alert-circle-outline" size={16} color={t.error} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            onPress={submit}
                            disabled={busy || !email.trim() || !password}
                            style={[
                                styles.button,
                                (busy || !email.trim() || !password) && { opacity: 0.5 },
                            ]}
                            accessibilityRole="button"
                        >
                            {busy
                                ? <ActivityIndicator color={t.onAccent} />
                                : <Text style={styles.buttonText}>Sign in</Text>}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.statusRow}>
                        <Ionicons name="shield-checkmark-outline" size={14} color="#28C76F" />
                        <Text style={styles.statusText}>Office VPN connected</Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    flex: { flex: 1 },
    centered: { alignItems: 'center', justifyContent: 'center' },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
    logo: { width: 140, height: 46, alignSelf: 'center', marginBottom: 18 },
    title: { color: t.textPrimary, fontSize: 22, fontWeight: '700', textAlign: 'center' },
    subtitle: {
        color: t.textSecondary, fontSize: 13, textAlign: 'center',
        marginTop: 4, marginBottom: 22,
    },
    card: {
        backgroundColor: t.surface,
        borderWidth: 1, borderColor: t.border,
        borderRadius: 16, padding: 18,
    },
    label: { color: t.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
    input: {
        backgroundColor: t.inputBackground,
        borderWidth: 1, borderColor: t.border,
        borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12,
        color: t.textPrimary, fontSize: 15,
    },
    passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    passwordInput: { flex: 1, color: t.textPrimary, fontSize: 15, padding: 0 },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    errorText: { color: t.error, fontSize: 13, flex: 1 },
    button: {
        marginTop: 18,
        backgroundColor: t.accent,
        borderRadius: 12, paddingVertical: 14,
        alignItems: 'center',
    },
    buttonText: { color: t.onAccent, fontSize: 15, fontWeight: '700' },
    statusRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, marginTop: 18,
    },
    statusText: { color: t.textSecondary, fontSize: 12 },
});
