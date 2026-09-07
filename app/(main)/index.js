import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../context/ThemeContext';
import { useStaff } from '../context/StaffContext';
import { visibleMenu } from '../utils/menu';
import api from '../services/api';
import { isMine } from '../utils/tickets';
import { onboardedThisMonth, statLine } from '../utils/dashboard';
import Card, { CardHeader, cardGap } from '../components/Card';
import TicketRow from '../components/TicketRow';

// A launcher, matching the reference app's dashboard, with a one-line stat
// under each tile. Each stat is its own request, started independently and
// failed silently — a slow or 403'd endpoint just leaves that tile's second
// line blank rather than holding up the grid or the screen.
export default function Home() {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;
    const { staff } = useStaff();

    const menu = useMemo(() => visibleMenu(staff), [staff]);

    // `visibleMenu` allocates a new array on every staff change, even when
    // the set of visible keys hasn't actually changed. Keying the fetch
    // effect on this joined string instead means the four requests fire once
    // per mount, plus once more only if a permission truly appears or
    // disappears — not on every profile refresh.
    const menuKeys = menu.map((item) => item.key).join(',');

    const [stats, setStats] = useState({});
    const [ticketRows, setTicketRows] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    // Derived rather than stored: the moment `staff` resolves (cache, then
    // /api/me), this recomputes from whatever page of tickets is already in
    // hand — no refetch, and no window where the card or badge is wrongly
    // empty because assignment couldn't be checked yet.
    const yourTickets = useMemo(
        () => ticketRows.filter((t) => isMine(t, staff)),
        [ticketRows, staff],
    );

    // One place for the four fetches, so pulling down re-runs exactly what the
    // mount does. `isCancelled` is asked at the moment a reply lands, so the
    // effect can drop one that arrives after the screen has gone.
    const loadStats = useCallback((isCancelled = () => false) => {
        const requests = menuKeys.split(',').map((key) => {
            if (key === 'clients') {
                return api.clients()
                    .then((rows) => {
                        if (isCancelled()) return;

                        const activeClients = (rows || []).filter((c) => c.status === 'active').length;

                        setStats((prev) => ({ ...prev, activeClients }));
                    })
                    .catch(() => {});
            }

            if (key === 'tickets') {
                return api.tickets({ page: 1, limit: 30 })
                    .then((response) => {
                        if (isCancelled()) return;

                        const rows = Array.isArray(response?.tickets) ? response.tickets : [];

                        setStats((prev) => ({ ...prev, openTickets: Number(response?.total) || 0 }));
                        setTicketRows(rows);
                    })
                    .catch(() => {});
            }

            if (key === 'onboarding') {
                return api.assetOnboarding()
                    .then((response) => {
                        if (isCancelled()) return;

                        setStats((prev) => ({ ...prev, machinesThisMonth: onboardedThisMonth(response?.assets) }));
                    })
                    .catch(() => {});
            }

            if (key === 'address-book') {
                return api.addressBook()
                    .then((rows) => {
                        if (isCancelled()) return;

                        setStats((prev) => ({ ...prev, contacts: (rows || []).length }));
                    })
                    .catch(() => {});
            }

            return null;
        });

        return Promise.all(requests);
    }, [menuKeys]);

    useEffect(() => {
        let cancelled = false;

        loadStats(() => cancelled);

        return () => { cancelled = true; };
    }, [loadStats]);

    const refresh = useCallback(() => {
        setRefreshing(true);
        loadStats().then(() => setRefreshing(false));
    }, [loadStats]);

    return (
        <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
            }
        >
            <View style={styles.grid}>
                {menu.map((item) => {
                    const stat = statLine(item.key, { ...stats, yourTickets: yourTickets.length });
                    const badge = item.key === 'tickets' ? yourTickets.length : 0;

                    return (
                        <View key={item.key} style={styles.tileWrap}>
                            <Card onPress={() => router.push(item.href)} style={styles.tile}>
                                <View style={styles.tileTop}>
                                    <View style={[styles.iconCircle, { backgroundColor: colors.primary + '1A' }]}>
                                        <FontAwesome name={item.icon} size={17} color={colors.primary} />
                                    </View>
                                    {badge > 0 ? (
                                        <View style={[styles.badge, { backgroundColor: colors.primary + '1A' }]}>
                                            <Text style={[styles.badgeText, { color: colors.primary }]}>{badge}</Text>
                                        </View>
                                    ) : null}
                                </View>

                                <View style={styles.tileCopy}>
                                    <Text style={[styles.tileLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                                    {stat ? (
                                        <Text style={[styles.tileStat, { color: colors.textSecondary }]}>{stat}</Text>
                                    ) : null}
                                </View>
                            </Card>
                        </View>
                    );
                })}
            </View>

            {yourTickets.length > 0 ? (
                <Card>
                    <CardHeader title="Your open tickets" meta={yourTickets.length} />
                    {yourTickets.map((ticket, index) => (
                        <TicketRow key={String(ticket.id)} ticket={ticket} index={index} />
                    ))}
                </Card>
            ) : null}

            <Text style={[styles.footnote, { color: colors.textSecondary }]}>
                Read only. Changes are made in Accel Online.
            </Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { padding: 16, gap: cardGap },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    // Card sends its `style` to the inner clipping view, not the outer
    // TouchableOpacity that actually sizes itself in the grid row — so the
    // column width has to live on this wrapper instead of on the Card.
    tileWrap: { width: '48%' },
    tile: { padding: 14, minHeight: 96, justifyContent: 'space-between' },
    tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconCircle: {
        width: 38, height: 38, borderRadius: 19,
        alignItems: 'center', justifyContent: 'center',
    },
    badge: {
        minWidth: 26, paddingHorizontal: 8, paddingVertical: 2,
        borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    },
    badgeText: { fontSize: 12, fontWeight: '700' },
    tileCopy: { gap: 3 },
    tileLabel: { fontSize: 15, fontWeight: '700' },
    tileStat: { fontSize: 12 },
    footnote: { fontSize: 11, textAlign: 'center', marginTop: 6 },
});
