import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Theme from '../context/ThemeContext';

const MASK = '••••••••••••';

// Masked until asked for, and never shown by default — a phone gets carried
// around and put down, and a password left on screen is the same as a password
// on a sticky note. `large` renders the value big and monospaced for the
// onboarding screen, where it is read off the phone while being typed into a
// machine.
export default function RevealField({ label, value, onReveal, large }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const [revealed, setRevealed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [resolved, setResolved] = useState(value ?? null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState(null);

    const toggle = useCallback(async () => {
        if (revealed) {
            setRevealed(false);

            return;
        }

        if (resolved != null) {
            setRevealed(true);

            return;
        }

        if (!onReveal) return;

        setBusy(true);
        setError(null);

        try {
            const fetched = await onReveal();

            setResolved(fetched ?? null);
            setRevealed(true);
        } catch (err) {
            setError(err.message || 'Could not fetch');
        } finally {
            setBusy(false);
        }
    }, [revealed, resolved, onReveal]);

    const copy = useCallback(async () => {
        if (resolved == null) return;

        await Clipboard.setStringAsync(String(resolved));
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
    }, [resolved]);

    return (
        <View style={styles.wrap}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>

            <View style={styles.row}>
                <Text
                    style={[
                        large ? styles.valueLarge : styles.value,
                        { color: revealed ? colors.textPrimary : colors.textSecondary },
                    ]}
                    numberOfLines={large ? 1 : 2}
                    selectable={revealed}
                >
                    {revealed ? (resolved ?? '—') : MASK}
                </Text>

                <TouchableOpacity
                    onPress={toggle}
                    disabled={busy}
                    style={[styles.action, { borderColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={revealed ? `Hide ${label}` : `Show ${label}`}
                >
                    {busy
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Ionicons
                            name={revealed ? 'eye-off-outline' : 'eye-outline'}
                            size={17}
                            color={colors.primary}
                          />}
                </TouchableOpacity>

                {revealed && resolved != null ? (
                    <TouchableOpacity
                        onPress={copy}
                        style={[styles.action, { borderColor: colors.border }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Copy ${label}`}
                    >
                        <Ionicons
                            name={copied ? 'checkmark' : 'copy-outline'}
                            size={16}
                            color={copied ? colors.success : colors.primary}
                        />
                    </TouchableOpacity>
                ) : null}
            </View>

            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 6 },
    label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    value: { flex: 1, fontSize: 15, fontWeight: '600' },
    valueLarge: {
        flex: 1, fontSize: 22, fontWeight: '700', letterSpacing: 1,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    action: {
        width: 38, height: 38, borderRadius: 19, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    error: { fontSize: 12 },
});
