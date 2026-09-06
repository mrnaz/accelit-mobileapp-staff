import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Theme from '../context/ThemeContext';
import { formatPhone, dialUri, mailUri } from '../utils/phone';

// Buttons are dimmed and inert rather than hidden when there is nothing to
// dial, so row heights stay constant down a long list.
export default function ContactRow({ name, subtitle, phone, email, showDivider, badge }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const tel = dialUri(phone);
    const mail = mailUri(email);
    const shown = formatPhone(phone);

    const open = (uri) => { if (uri) Linking.openURL(uri); };

    return (
        <View style={[styles.row, showDivider && { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={styles.identity}>
                <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                        {name}
                    </Text>
                    {badge ? (
                        <View style={[styles.badge, { backgroundColor: colors.primary + '1A' }]}>
                            <Text style={[styles.badgeText, { color: colors.primary }]}>{badge}</Text>
                        </View>
                    ) : null}
                </View>

                {subtitle ? (
                    <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : null}
                {shown ? (
                    <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                        {shown}
                    </Text>
                ) : null}
                {email ? (
                    <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                        {email}
                    </Text>
                ) : null}
            </View>

            <View style={styles.actions}>
                <TouchableOpacity
                    onPress={() => open(tel)}
                    disabled={!tel}
                    style={[styles.action, { borderColor: colors.border, opacity: tel ? 1 : 0.3 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${name}`}
                >
                    <Ionicons name="call-outline" size={17} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => open(mail)}
                    disabled={!mail}
                    style={[styles.action, { borderColor: colors.border, opacity: mail ? 1 : 0.3 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Email ${name}`}
                >
                    <Ionicons name="mail-outline" size={17} color={colors.primary} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    identity: { flex: 1, gap: 2 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
    badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
    badgeText: { fontSize: 10, fontWeight: '700' },
    meta: { fontSize: 12 },
    actions: { flexDirection: 'row', gap: 8 },
    action: {
        width: 38, height: 38, borderRadius: 19, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
});
