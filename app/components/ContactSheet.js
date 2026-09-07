import React, { useRef } from 'react';
import {
    View, Text, Modal, TouchableOpacity, TouchableWithoutFeedback, Linking, StyleSheet,
} from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Theme from '../context/ThemeContext';
import Avatar from './Avatar';
import LabelValue from './LabelValue';
import Toast, { useToast } from './Toast';
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
// `onUsed` fires on a call, text or email so the screen can bump its recents.
//
// The copy toast lives in here rather than on the screen: a Modal is its own
// native window above every parent view, so a pill rendered beside the sheet
// would be painted underneath it.
export default function ContactSheet({ person, visible, onClose, onUsed }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;
    const [toast, showToast] = useToast();

    // The sheet fades out after `person` is cleared, so the last one shown has
    // to outlive it — otherwise the closing frame is an empty sheet.
    const lastPerson = useRef(person);

    if (person) lastPerson.current = person;

    const subject = person || lastPerson.current;

    if (!subject) return null;

    const shownPhone = formatPhone(subject.phone);
    const tel = dialUri(subject.phone);
    const sms = smsUri(subject.phone);
    const mail = mailUri(subject.email);

    const use = (uri) => {
        Linking.openURL(uri);
        onUsed?.();
    };

    const copy = async () => {
        await Clipboard.setStringAsync(shownPhone);
        showToast('Number copied');
    };

    const openClient = () => {
        onClose();
        router.push(`/client/${subject.clientId}`);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
            >
                <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
                    <TouchableWithoutFeedback>
                        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={[styles.grabber, { backgroundColor: colors.border }]} />

                            <View style={styles.header}>
                                <Avatar uri={null} name={subject.name} id={subject.avatarId} size={56} />

                                <View style={styles.identity}>
                                    <View style={styles.nameRow}>
                                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>
                                            {subject.name}
                                        </Text>
                                        {subject.isClient ? (
                                            <View style={[styles.badge, { backgroundColor: colors.primary + '1A' }]}>
                                                <Text style={[styles.badgeText, { color: colors.primary }]}>Client</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                    <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {subject.subtitle}
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
                                <LabelValue label="Email" value={subject.email} last />
                            </View>

                            {subject.clientId ? (
                                <TouchableOpacity
                                    onPress={openClient}
                                    style={[styles.clientRow, { borderTopColor: colors.border }]}
                                >
                                    <FontAwesome name="building-o" size={16} color={colors.primary} />
                                    <Text style={[styles.clientText, { color: colors.textPrimary }]} numberOfLines={1}>
                                        Open {subject.clientName || subject.name}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </TouchableWithoutFeedback>

                    <Toast message={toast} />
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
