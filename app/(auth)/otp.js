import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ActivityIndicator,
    StyleSheet, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../services/api';
import { persistAuth, clearAuth } from '../utils/authFlow';
import { sanitizeOtp, isCompleteOtp } from '../utils/otp';
import t from '../constants/authTheme';

const METHOD_LABELS = { totp: 'Authenticator app', sms: 'Text message', email: 'Email' };

export default function OtpScreen() {
    const params = useLocalSearchParams();

    const [mfaType, setMfaType] = useState(params.mfaType || '');
    const [maskedMFA, setMaskedMFA] = useState(params.maskedMFA || '');
    const [code, setCode] = useState('');
    const [remember, setRemember] = useState(true);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [switching, setSwitching] = useState(false);
    const inputRef = useRef(null);

    const methods = useMemo(() => {
        try {
            const parsed = JSON.parse(params.availableMethods || '[]');

            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }, [params.availableMethods]);

    const submit = useCallback(async () => {
        if (busy || !isCompleteOtp(code)) return;

        setBusy(true);
        setError(null);

        try {
            const response = await api.checkOtp(code, remember);

            // check-otp answers a wrong code with HTTP 200 and {"verified": false}.
            // Branching on the status alone would sign the user in on a bad code.
            if (!response?.verified || !response?.token) {
                setError('That code was not accepted. Try the next one.');
                setCode('');

                return;
            }

            await persistAuth(response.token, response.device_token);
            router.replace('/(main)');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }, [busy, code, remember]);

    // Auto-verify as soon as the sixth digit lands, whether typed, pasted or
    // filled in by the OS from an SMS/keychain suggestion.
    useEffect(() => {
        if (isCompleteOtp(code)) submit();
    }, [code]);

    const switchTo = useCallback(async (method) => {
        if (switching || method === mfaType) return;

        setSwitching(true);
        setError(null);

        try {
            const response = await api.switchMfaMethod(method);

            setMfaType(response?.mfaType || method);
            setMaskedMFA(response?.maskedMFA || '');
            setCode('');
        } catch (err) {
            setError(err.message);
        } finally {
            setSwitching(false);
        }
    }, [switching, mfaType]);

    const cancel = useCallback(async () => {
        await clearAuth();
        router.replace('/(auth)/login');
    }, []);

    const subtitle = mfaType === 'totp'
        ? 'From your authenticator app. It verifies as soon as all six digits are in.'
        : mfaType === 'email'
            ? `Sent by email to ${maskedMFA || 'you'}. It verifies as soon as all six digits are in.`
            : `Sent by text to ${maskedMFA || 'you'}. It verifies as soon as all six digits are in.`;

    return (
        <SafeAreaView style={styles.screen}>
            <StatusBar style="light" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.body}>
                    <TouchableOpacity onPress={cancel} style={styles.back} accessibilityRole="button">
                        <Ionicons name="chevron-back" size={22} color={t.textSecondary} />
                        <Text style={styles.backText}>Back to sign in</Text>
                    </TouchableOpacity>

                    <Text style={styles.title}>Enter your code</Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>

                    <TouchableOpacity
                        style={styles.boxRow}
                        activeOpacity={1}
                        onPress={() => inputRef.current?.focus()}
                    >
                        {Array.from({ length: 6 }).map((_, index) => {
                            const active = index === Math.min(code.length, 5);

                            return (
                                <View
                                    key={index}
                                    style={[styles.box, active && styles.boxActive]}
                                >
                                    <Text style={styles.boxDigit}>{code[index] || ''}</Text>
                                </View>
                            );
                        })}
                    </TouchableOpacity>

                    <TextInput
                        ref={inputRef}
                        value={code}
                        onChangeText={(v) => setCode(sanitizeOtp(v))}
                        style={styles.hiddenInput}
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        autoComplete="one-time-code"
                        maxLength={6}
                        editable={!busy}
                        autoFocus
                    />

                    <View style={styles.rememberRow}>
                        <View style={styles.rememberCopy}>
                            <Text style={styles.rememberLabel}>Remember this device</Text>
                            <Text style={styles.rememberHint}>Skips this step for three weeks</Text>
                        </View>
                        <Switch
                            value={remember}
                            onValueChange={setRemember}
                            disabled={busy}
                            trackColor={{ true: t.accent }}
                        />
                    </View>

                    {error ? (
                        <View style={styles.errorRow}>
                            <Ionicons name="alert-circle-outline" size={16} color={t.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        onPress={submit}
                        disabled={busy || !isCompleteOtp(code)}
                        style={[styles.button, (busy || !isCompleteOtp(code)) && { opacity: 0.5 }]}
                        accessibilityRole="button"
                    >
                        {busy
                            ? <ActivityIndicator color={t.onAccent} />
                            : <Text style={styles.buttonText}>Verify</Text>}
                    </TouchableOpacity>

                    {methods.length > 1 ? (
                        <View style={styles.switchBlock}>
                            <Text style={styles.switchLabel}>Didn't get it? Use a different method</Text>
                            <View style={styles.pills}>
                                {methods.map((method) => {
                                    const active = method === mfaType;

                                    return (
                                        <TouchableOpacity
                                            key={method}
                                            onPress={() => switchTo(method)}
                                            disabled={switching || active}
                                            style={[
                                                styles.pill,
                                                active && { borderColor: t.accent, backgroundColor: t.accent + '22' },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.pillText,
                                                    active && { color: t.textPrimary, fontWeight: '700' },
                                                ]}
                                            >
                                                {METHOD_LABELS[method] || method}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    ) : null}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    flex: { flex: 1 },
    body: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 4 },
    back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 18 },
    backText: { color: t.textSecondary, fontSize: 13 },
    title: { color: t.textPrimary, fontSize: 21, fontWeight: '700' },
    subtitle: { color: t.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 20 },
    boxRow: { flexDirection: 'row', gap: 8 },
    box: {
        flex: 1, height: 56,
        borderRadius: 12,
        backgroundColor: t.inputBackground,
        borderWidth: 1, borderColor: t.border,
        alignItems: 'center', justifyContent: 'center',
    },
    boxActive: { borderColor: t.accent },
    boxDigit: { color: t.textPrimary, fontSize: 26, fontWeight: '700', textAlign: 'center' },
    hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
    rememberRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginTop: 18,
    },
    rememberCopy: { flex: 1, gap: 2 },
    rememberLabel: { color: t.textPrimary, fontSize: 14, fontWeight: '600' },
    rememberHint: { color: t.textSecondary, fontSize: 12 },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
    errorText: { color: t.error, fontSize: 13, flex: 1 },
    button: {
        marginTop: 20,
        backgroundColor: t.accent,
        borderRadius: 12, paddingVertical: 14,
        alignItems: 'center',
    },
    buttonText: { color: t.onAccent, fontSize: 15, fontWeight: '700' },
    switchBlock: { marginTop: 26, gap: 8 },
    switchLabel: { color: t.textSecondary, fontSize: 12, fontWeight: '600' },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
        borderWidth: 1, borderColor: t.border, borderRadius: 999,
        paddingHorizontal: 14, paddingVertical: 8,
    },
    pillText: { color: t.textSecondary, fontSize: 13 },
});
