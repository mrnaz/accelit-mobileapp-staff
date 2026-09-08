import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import Theme from '../context/ThemeContext';
import Avatar from './Avatar';
import IconButton from './IconButton';
import { formatPhone, dialUri } from '../utils/phone';

// One person, one line of meta, one action. Email left the row when the
// contact sheet took it over: tapping the row is now the way to everything
// else, so the only button left is the one thing the screen exists for.
//
// `badge` overrides the default `Client` badge — the client page's contacts
// tab marks its primary contact with it.
export default function PersonRow({ person, onPress, showDivider, badge }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const tel = dialUri(person.phone);
    const meta = [person.subtitle, formatPhone(person.phone)].filter(Boolean).join(' · ');
    const badgeText = badge || (person.isClient ? 'Client' : null);

    return (
        <View style={[styles.row, showDivider && { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.body}>
                <Avatar uri={null} name={person.name} id={person.avatarId} size={40} />

                <View style={styles.identity}>
                    <View style={styles.nameRow}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                            {person.name}
                        </Text>
                        {badgeText ? (
                            <View style={[styles.badge, { backgroundColor: colors.primary + '1A' }]}>
                                <Text style={[styles.badgeText, { color: colors.primary }]}>{badgeText}</Text>
                            </View>
                        ) : null}
                    </View>

                    {meta ? (
                        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                            {meta}
                        </Text>
                    ) : null}
                </View>
            </TouchableOpacity>

            <IconButton
                icon="call-outline"
                label={`Call ${person.name}`}
                disabled={!tel}
                onPress={() => Linking.openURL(tel)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
    body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    identity: { flex: 1, gap: 2 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
    badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
    badgeText: { fontSize: 10, fontWeight: '700' },
    meta: { fontSize: 12 },
});
