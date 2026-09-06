import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
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

    const [stats, setStats] = useState({});
    const [yourTickets, setYourTickets] = useState([]);

    useEffect(() => {
        let cancelled = false;

        menu.forEach((item) => {
            if (item.key === 'clients') {
                api.clients()
                    .then((rows) => {
                        if (cancelled) return;

                        const activeClients = (rows || []).filter((c) => c.status === 'active').length;

                        setStats((prev) => ({ ...prev, activeClients }));
                    })
                    .catch(() => {});
            } else if (item.key === 'tickets') {
                api.tickets({ page: 1, limit: 30 })
                    .then((response) => {
                        if (cancelled) return;

                        const rows = Array.isArray(response?.tickets) ? response.tickets : [];
                        const mine = rows.filter((t) => isMine(t, staff));

                        setStats((prev) => ({
                            ...prev,
                            openTickets: Number(response?.total) || 0,
                            yourTickets: mine.length,
                        }));
                        setYourTickets(mine);
                    })
                    .catch(() => {});
            } else if (item.key === 'onboarding') {
                api.assetOnboarding()
                    .then((response) => {
                        if (cancelled) return;

                        setStats((prev) => ({ ...prev, machinesThisMonth: onboardedThisMonth(response?.assets) }));
                    })
                    .catch(() => {});
            } else if (item.key === 'address-book') {
                api.addressBook()
                    .then((rows) => {
                        if (cancelled) return;

                        setStats((prev) => ({ ...prev, contacts: (rows || []).length }));
                    })
                    .catch(() => {});
            }
        });

        return () => { cancelled = true; };
    }, [menu]);

    return (
        <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.grid}>
                {menu.map((item) => {
                    const stat = statLine(item.key, stats);
                    const badge = item.key === 'tickets' ? yourTickets.length : 0;

                    return (
                        <Card key={item.key} onPress={() => router.push(item.href)} style={styles.tile}>
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
    tile: { width: '48%', padding: 14, minHeight: 96, justifyContent: 'space-between' },
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
