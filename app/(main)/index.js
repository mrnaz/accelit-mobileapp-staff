import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import Theme from '../context/ThemeContext';
import { useStaff } from '../context/StaffContext';
import api from '../services/api';
import { isMine } from '../utils/tickets';
import Card, { CardHeader, cardGap } from '../components/Card';
import ScreenState from '../components/ScreenState';
import TicketRow from '../components/TicketRow';

// The dashboard is the one list that matters on a phone: the tickets assigned
// to you. Everything else is a Jump-to away.
export default function Home() {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;
    const { staff } = useStaff();

    const [ticketRows, setTicketRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Derived rather than stored: the moment `staff` resolves (cache, then
    // /api/me), this recomputes from whatever page of tickets is already in
    // hand — no refetch, and no window where the card is wrongly empty
    // because assignment couldn't be checked yet.
    const yourTickets = useMemo(
        () => ticketRows.filter((t) => isMine(t, staff)),
        [ticketRows, staff],
    );

    // The backend sorts the current user's tickets first, so the first page
    // is enough to find yours.
    const load = useCallback(async ({ refresh = false } = {}) => {
        if (refresh) setRefreshing(true); else setLoading(true);
        setError(null);

        try {
            const response = await api.tickets({ page: 1, limit: 30 });

            setTicketRows(Array.isArray(response?.tickets) ? response.tickets : []);
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => load({ refresh: true })}
                    tintColor={colors.primary}
                />
            }
        >
            <Card>
                <CardHeader title="Your open tickets" meta={yourTickets.length || undefined} />
                {yourTickets.length ? (
                    yourTickets.map((ticket, index) => (
                        <TicketRow key={String(ticket.id)} ticket={ticket} index={index} />
                    ))
                ) : (
                    <ScreenState
                        loading={loading}
                        error={error}
                        empty={!loading && !error}
                        emptyText="No open tickets assigned to you"
                        onRetry={load}
                    />
                )}
            </Card>

            <Text style={[styles.footnote, { color: colors.textSecondary }]}>
                Read only. Changes are made in Accel Online.
            </Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { padding: 16, gap: cardGap },
    footnote: { fontSize: 11, textAlign: 'center', marginTop: 6 },
});
