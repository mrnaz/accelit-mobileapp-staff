import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../context/ThemeContext';
import { useStaff } from '../context/StaffContext';
import api from '../services/api';
import Card, { cardGap } from '../components/Card';
import ScreenState from '../components/ScreenState';
import SearchField from '../components/SearchField';
import Pills from '../components/Pills';
import useDebounced from '../utils/useDebounced';
import { priorityColor, priorityLabel, isMine } from '../utils/tickets';
import { relativeTime } from '../utils/datetime';

const PAGE_SIZE = 30;

const FILTERS = [
    { value: 'open', label: 'Open' },
    { value: 'done', label: 'Completed' },
];

// GET /api/tickets is one of the few endpoints that paginates and searches
// server-side: {tickets: [...], total: n}, with limit/page and a broad search
// across title, client, ref, assignees and tags.
//
// There is no "assigned to me" parameter. The backend does sort the current
// user's tickets first, then unassigned, then everyone else's — so yours lead
// the list, and rows assigned to you carry a chip rather than the app shipping
// a filter that would only ever see the page it had already loaded.
export default function Tickets() {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;
    const { staff } = useStaff();

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('open');

    const term = useDebounced(search, 300);
    const seq = useRef(0);
    const inFlight = useRef(false);

    const fetchPage = useCallback(async (nextPage, mode) => {
        if (inFlight.current && mode === 'more') return;

        inFlight.current = true;
        const ticket = ++seq.current;

        if (mode === 'refresh') setRefreshing(true);
        else if (mode === 'more') setLoadingMore(true);
        else setLoading(true);

        try {
            const response = await api.tickets({
                completed: filter === 'done',
                search: term.trim() || undefined,
                page: nextPage,
                limit: PAGE_SIZE,
            });

            // A newer request has started; this reply is stale.
            if (ticket !== seq.current) return;

            const fresh = Array.isArray(response?.tickets) ? response.tickets : [];

            setRows((prev) => (nextPage > 1 ? [...prev, ...fresh] : fresh));
            setTotal(Number(response?.total) || 0);
            setPage(nextPage);
            setError(null);
        } catch (err) {
            if (ticket === seq.current && err.status !== 401) setError(err.message);
        } finally {
            if (ticket === seq.current) {
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
            }
            inFlight.current = false;
        }
    }, [filter, term]);

    useEffect(() => { fetchPage(1, 'initial'); }, [fetchPage]);

    const loadMore = useCallback(() => {
        if (loading || loadingMore || rows.length >= total) return;

        fetchPage(page + 1, 'more');
    }, [loading, loadingMore, rows.length, total, page, fetchPage]);

    const renderItem = useCallback(({ item }) => {
        const mine = isMine(item, staff);

        return (
            <Card onPress={() => router.push(`/ticket/${item.id}`)} style={styles.card}>
                <View style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: priorityColor(item.priority, colors) }]} />

                    <View style={styles.copy}>
                        <View style={styles.titleRow}>
                            <Text style={[styles.ref, { color: colors.textSecondary }]}>
                                #{item.ticket_ref_with_check_digit || item.ticket_ref}
                            </Text>
                            {mine ? (
                                <View style={[styles.chip, { backgroundColor: colors.primary + '1A' }]}>
                                    <Text style={[styles.chipText, { color: colors.primary }]}>You</Text>
                                </View>
                            ) : null}
                        </View>

                        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                            {item.title}
                        </Text>

                        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                            {[
                                item.client_name,
                                priorityLabel(item.priority),
                                relativeTime(item.latest_action || item.created_at),
                            ].filter(Boolean).join(' · ')}
                        </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </View>
            </Card>
        );
    }, [colors, staff]);

    return (
        <View style={styles.screen}>
            <View style={styles.controls}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Ticket, client or ref" />
                <Pills options={FILTERS} value={filter} onChange={setFilter} />
            </View>

            <FlatList
                data={rows}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                onEndReached={loadMore}
                onEndReachedThreshold={0.4}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => fetchPage(1, 'refresh')}
                        tintColor={colors.primary}
                    />
                }
                ListFooterComponent={
                    loadingMore ? (
                        <View style={styles.footer}>
                            <ActivityIndicator color={colors.primary} />
                        </View>
                    ) : rows.length > 0 && rows.length >= total ? (
                        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                            {total} {filter === 'done' ? 'completed' : 'open'}
                        </Text>
                    ) : null
                }
                ListEmptyComponent={
                    <ScreenState
                        loading={loading && rows.length === 0}
                        error={!loading && rows.length === 0 ? error : null}
                        empty={!loading && !error}
                        emptyText={search ? 'No tickets match that' : 'Nothing open'}
                        onRetry={() => fetchPage(1, 'initial')}
                    />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    controls: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 10 },
    list: { paddingHorizontal: 16, paddingBottom: 24, gap: cardGap, flexGrow: 1 },
    card: { padding: 12 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
    copy: { flex: 1, gap: 3 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ref: { fontSize: 11, fontWeight: '700' },
    chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
    chipText: { fontSize: 10, fontWeight: '700' },
    title: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
    meta: { fontSize: 12 },
    footer: { paddingVertical: 16, alignItems: 'center' },
    footerText: { fontSize: 12, textAlign: 'center', paddingVertical: 16 },
});
