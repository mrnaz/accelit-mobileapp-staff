import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import Theme from '../context/ThemeContext';
import { isSupported, getStatus, turnOn, turnOff, errorText } from '../utils/contactSync';

const NOTES = {
    denied: 'Contacts permission is needed to show the directory in your phone.',
    blocked: 'Contacts permission is blocked. Tap to open settings.',
    error: 'Could not turn this on. Try again.',
};

// Android only. Puts the staff directory into the phone's own contacts, under
// an account this app owns, so callers are named even when the app is closed.
export default function ContactSyncRow({ refreshKey }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const supported = isSupported();

    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState(null);

    const reload = useCallback(async () => { setStatus(await getStatus()); }, []);

    useEffect(() => {
        if (supported) reload();
    }, [supported, reload, refreshKey]);

    // The first sync is queued, not awaited. Look again shortly so "Syncing…"
    // becomes "Synced" without the user having to pull to refresh.
    useEffect(() => {
        if (!status?.enabled || status.lastSuccessAt || status.lastError) return undefined;

        const timer = setTimeout(reload, 5000);

        return () => clearTimeout(timer);
    }, [status, reload]);

    const onToggle = useCallback(async (next) => {
        setBusy(true);
        setProblem(null);

        if (next) {
            const result = await turnOn();

            if (!result.ok) setProblem(result.reason);
        } else {
            await turnOff();
        }

        await reload();
        setBusy(false);
    }, [reload]);

    if (!supported || !status) return null;

    const on = status.enabled && status.accountExists;

    let caption = 'Adds the directory to caller ID on this phone.';

    if (problem) caption = NOTES[problem] || NOTES.error;
    else if (on && status.lastError) caption = errorText(status.lastError);
    else if (on && status.lastSuccessAt) caption = `Synced ${moment(status.lastSuccessAt).fromNow()}`;
    else if (on) caption = 'Syncing…';

    const warn = !!problem || (on && !!status.lastError);

    const captionNode = (
        <Text style={[styles.caption, { color: warn ? colors.error : colors.textSecondary }]}>{caption}</Text>
    );

    return (
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="call-outline" size={17} color={colors.primary} />

            <View style={styles.text}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    Show in phone contacts
                </Text>

                {problem === 'blocked' ? (
                    <TouchableOpacity onPress={() => Linking.openSettings()} accessibilityRole="button">
                        {captionNode}
                    </TouchableOpacity>
                ) : captionNode}
            </View>

            <Switch
                value={on}
                onValueChange={onToggle}
                disabled={busy}
                trackColor={{ true: colors.primary }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        borderWidth: 1, borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 8, marginTop: 10,
    },
    text: { flex: 1 },
    title: { fontSize: 14, fontWeight: '600' },
    caption: { fontSize: 12, marginTop: 1 },
});
