import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../../context/ThemeContext';
import api from '../../services/api';
import Card, { cardGap } from '../Card';
import ScreenState from '../ScreenState';
import Pills from '../Pills';
import { priorityColor, priorityLabel } from '../../utils/tickets';
import { relativeTime } from '../../utils/datetime';

const FILTERS = [
    { value: 'open', label: 'Open' },
    { value: 'done', label: 'Completed' },
];

// Note: GET /api/clients/{client}/tickets returns a different column set from
// the global list — ticket_level is absent here — so this renders its own row
// rather than sharing one with the Tickets screen.
export default function TicketsTab({ clientId }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('open');

    const load = useCallback(async ({ refresh = false } = {}) => {
        if (refresh) setRefreshing(true); else setLoading(true);
        setError(null);

        try {
            const response = await api.clientTickets(clientId, { completed: filter === 'done', limit: 100 });

            setRows(Array.isArray(response?.tickets) ? response.tickets : []);
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [clientId, filter]);

    useEffect(() => { load(); }, [load]);

    return (
        <View style={styles.wrap}>
            <View style={styles.controls}>
                <Pills options={FILTERS} value={filter} onChange={setFilter} />
            </View>

            <FlatList
                data={rows}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <Card onPress={() => router.push(`/ticket/${item.id}`)} style={styles.card}>
                        <View style={styles.row}>
                            <View style={[styles.dot, { backgroundColor: priorityColor(item.priority, colors) }]} />
                            <View style={styles.copy}>
                                <Text style={[styles.ref, { color: colors.textSecondary }]}>
                                    #{item.ticket_ref_with_check_digit || item.ticket_ref}
                                </Text>
                                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                                    {item.title}
                                </Text>
                                <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {[priorityLabel(item.priority), relativeTime(item.latest_action || item.created_at)]
                                        .filter(Boolean).join(' · ')}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                        </View>
                    </Card>
                )}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => load({ refresh: true })}
                        tintColor={colors.primary}
                    />
                }
                ListEmptyComponent={
                    <ScreenState
                        loading={loading && rows.length === 0}
                        error={!loading && rows.length === 0 ? error : null}
                        empty={!loading && !error}
                        emptyText={filter === 'done' ? 'Nothing completed' : 'No open tickets'}
                        onRetry={load}
                    />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1 },
    controls: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
    list: { paddingHorizontal: 16, paddingBottom: 24, gap: cardGap, flexGrow: 1 },
    card: { padding: 12 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
    copy: { flex: 1, gap: 3 },
    ref: { fontSize: 11, fontWeight: '700' },
    title: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
    meta: { fontSize: 12 },
});
