import React from 'react';
import {
    View, Text, Modal, TouchableOpacity, TouchableWithoutFeedback, Linking, StyleSheet,
} from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Theme from '../context/ThemeContext';
import Avatar from './Avatar';
import LabelValue from './LabelValue';
import { formatPhone, dialUri, mailUri, smsUri } from '../utils/phone';

// One tile of the action grid. Dimmed and inert when there is nothing behind
// it, so the grid keeps its four columns for everyone.
function ActionTile({ icon, label, disabled, onPress }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={[styles.tile, { borderColor: colors.border, opacity: disabled ? 0.3 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Ionicons name={icon} size={22} color={colors.primary} />
            <Text style={[styles.tileLabel, { color: colors.textPrimary }]}>{label}</Text>
        </TouchableOpacity>
    );
}

// Everything you can do with one person, one tap from the row that named them.
// `onCopied` lets the screen toast; `onUsed` fires on a call, text or email so
// the screen can bump its recents.
export default function ContactSheet({ person, visible, onClose, onCopied, onUsed }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    if (!person) return null;

    const shownPhone = formatPhone(person.phone);
    const tel = dialUri(person.phone);
    const sms = smsUri(person.phone);
    const mail = mailUri(person.email);

    const use = (uri) => {
        Linking.openURL(uri);
        onUsed?.();
    };

    const copy = async () => {
        await Clipboard.setStringAsync(shownPhone);
        onCopied?.('Number copied');
    };

    const openClient = () => {
        onClose();
        router.push(`/client/${person.clientId}`);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
                    <TouchableWithoutFeedback>
                        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={[styles.grabber, { backgroundColor: colors.border }]} />

                            <View style={styles.header}>
                                <Avatar uri={null} name={person.name} id={person.avatarId} size={56} />

                                <View style={styles.identity}>
                                    <View style={styles.nameRow}>
                                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>
                                            {person.name}
                                        </Text>
                                        {person.isClient ? (
                                            <View style={[styles.badge, { backgroundColor: colors.primary + '1A' }]}>
                                                <Text style={[styles.badgeText, { color: colors.primary }]}>Client</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                    <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {person.subtitle}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.grid}>
                                <ActionTile icon="call-outline" label="Call" disabled={!tel} onPress={() => use(tel)} />
                                <ActionTile icon="chatbubble-outline" label="SMS" disabled={!sms} onPress={() => use(sms)} />
                                <ActionTile icon="mail-outline" label="Email" disabled={!mail} onPress={() => use(mail)} />
                                <ActionTile icon="copy-outline" label="Copy" disabled={!shownPhone} onPress={copy} />
                            </View>

                            <View>
                                <LabelValue label="Phone" value={shownPhone} />
                                <LabelValue label="Email" value={person.email} last />
                            </View>

                            {person.clientId ? (
                                <TouchableOpacity
                                    onPress={openClient}
                                    style={[styles.clientRow, { borderTopColor: colors.border }]}
                                >
                                    <FontAwesome name="building-o" size={16} color={colors.primary} />
                                    <Text style={[styles.clientText, { color: colors.textPrimary }]} numberOfLines={1}>
                                        Open {person.clientName || person.name}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 18, paddingTop: 14, paddingBottom: 44,
        gap: 14,
    },
    grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    identity: { flex: 1, gap: 2 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
    badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
    badgeText: { fontSize: 10, fontWeight: '700' },
    subtitle: { fontSize: 12 },

    grid: { flexDirection: 'row', gap: 10 },
    tile: {
        flex: 1, borderWidth: 1, borderRadius: 14,
        paddingHorizontal: 4, paddingVertical: 12,
        alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    tileLabel: { fontSize: 12, fontWeight: '600' },

    clientRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 12, borderTopWidth: 1,
    },
    clientText: { flex: 1, fontSize: 14, fontWeight: '600' },
});
