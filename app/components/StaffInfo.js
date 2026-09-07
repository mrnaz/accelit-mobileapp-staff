import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, Image, Modal, TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../context/ThemeContext';
import { useStaff } from '../context/StaffContext';
import { jumpMenu } from '../utils/menu';
import ThemeToggle from './ThemeToggle';
import LogoutButton from './LogoutButton';

// The identity band, and the app's main menu. There is no drawer: the menu is
// a "Jump to" grid that drops from the top when you tap the logo, and the
// avatar opens a second sheet with the account controls.
export default function StaffInfo() {
    const { useTheme } = Theme;
    const { theme, mode } = useTheme();
    const { colors } = theme;
    const insets = useSafeAreaInsets();
    const { staff } = useStaff();

    const [jumpOpen, setJumpOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);

    const menu = useMemo(() => jumpMenu(staff), [staff]);

    const go = useCallback((href) => {
        setJumpOpen(false);
        router.push(href);
    }, []);

    const fullName = staff ? `${staff.fname || ''} ${staff.sname || ''}`.trim() : '';
    const initials = staff
        ? `${(staff.fname || '?')[0] || ''}${(staff.sname || '')[0] || ''}`.toUpperCase()
        : '';

    return (
        <View style={[styles.band, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity
                onPress={() => setJumpOpen(true)}
                style={styles.logoButton}
                accessibilityRole="button"
                accessibilityLabel="Open menu"
            >
                {/* The brand mark, cut from the web app's logo. icon.png is the
                    white wordmark and disappears on the light surface, so the
                    mark swaps with the theme: navy on light, white on dark. */}
                <Image
                    source={mode === 'dark'
                        ? require('../../assets/logo-mark-light.png')
                        : require('../../assets/logo-mark-dark.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </TouchableOpacity>

            <View style={styles.identity}>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                    {fullName || 'Accel Staff'}
                </Text>
                {staff?.email ? (
                    <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
                        {staff.email}
                    </Text>
                ) : null}
            </View>

            <TouchableOpacity
                onPress={() => setAccountOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Account"
            >
                {staff?.photo ? (
                    <Image source={{ uri: staff.photo }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                        <Text style={styles.avatarText}>{initials || '·'}</Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* Jump-to grid */}
            <Modal visible={jumpOpen} transparent animationType="fade" onRequestClose={() => setJumpOpen(false)}>
                <TouchableWithoutFeedback onPress={() => setJumpOpen(false)}>
                    <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
                        <TouchableWithoutFeedback>
                            <View
                                style={[
                                    styles.sheet,
                                    {
                                        backgroundColor: colors.surface,
                                        paddingTop: insets.top + 16,
                                        borderBottomColor: colors.border,
                                    },
                                ]}
                            >
                                <Text style={[styles.sheetTitle, { color: colors.textSecondary }]}>Jump to</Text>
                                <View style={styles.grid}>
                                    {menu.map((item) => (
                                        <TouchableOpacity
                                            key={item.key}
                                            style={[styles.gridItem, { borderColor: colors.border }]}
                                            onPress={() => go(item.href)}
                                        >
                                            <FontAwesome name={item.icon} size={22} color={colors.primary} />
                                            <Text
                                                style={[styles.gridLabel, { color: colors.textPrimary }]}
                                                numberOfLines={2}
                                            >
                                                {item.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Account sheet */}
            <Modal visible={accountOpen} transparent animationType="fade" onRequestClose={() => setAccountOpen(false)}>
                <TouchableWithoutFeedback onPress={() => setAccountOpen(false)}>
                    <View style={[styles.backdrop, styles.centered, { backgroundColor: colors.overlay }]}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <Text style={[styles.cardName, { color: colors.textPrimary }]}>
                                    {fullName || 'Accel Staff'}
                                </Text>
                                {staff?.email ? (
                                    <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                                        {staff.email}
                                    </Text>
                                ) : null}

                                <View style={[styles.contextRow, { borderTopColor: colors.border }]}>
                                    <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
                                    <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                                        {staff?.sysadmin ? 'Sysadmin' : 'Staff'}
                                        {staff?.ticket_access ? ` · tickets: ${staff.ticket_access}` : ''}
                                    </Text>
                                </View>

                                <View style={styles.actions}>
                                    <ThemeToggle />
                                    <LogoutButton onDone={() => setAccountOpen(false)} />
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    band: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: 1,
    },
    logoButton: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
    },
    logo: { width: 34, height: 34 },
    identity: { flex: 1, gap: 1 },
    name: { fontSize: 14, fontWeight: '700' },
    email: { fontSize: 11 },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    backdrop: { flex: 1 },
    centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
    sheet: {
        paddingHorizontal: 16, paddingBottom: 20,
        borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
        borderBottomWidth: 1,
    },
    sheetTitle: {
        fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: 0.6, marginBottom: 12,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    gridItem: {
        width: '31%', aspectRatio: 1,
        borderWidth: 1, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingHorizontal: 6,
    },
    gridLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },

    card: { width: '100%', borderWidth: 1, borderRadius: 16, padding: 18, gap: 4 },
    cardName: { fontSize: 16, fontWeight: '700' },
    cardMeta: { fontSize: 12 },
    contextRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderTopWidth: 1, marginTop: 12, paddingTop: 12,
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
});
