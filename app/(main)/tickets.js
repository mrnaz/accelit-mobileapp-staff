import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import Theme from '../context/ThemeContext';
import { useStaff } from '../context/StaffContext';
import api from '../services/api';
import Card, { CardHeader, cardGap } from '../components/Card';
import TicketRow from '../components/TicketRow';
import ScreenState from '../components/ScreenState';
import SearchField from '../components/SearchField';
import Pills from '../components/Pills';
import useDebounced from '../utils/useDebounced';
import { partitionTickets } from '../utils/tickets';

const PAGE_SIZE = 30;

const FILTERS = [
    { value: 'open', label: 'Open' },
    { value: 'done', label: 'Completed' },
];

// The list is two cards, "Yours" and "Everyone else", each laid out like the
// Qobox student list: a header band with the title and a count, then every
// loaded row separated by dividers. The FlatList carries one synthetic item
// that renders both cards so pull-to-refresh and end-reached paging keep
// working against a single list.
const CARD = [{ key: 'tickets-card' }];

// GET /api/tickets is one of the few endpoints that paginates and searches
// server-side: {tickets: [...], total: n}, with limit/page and a broad search
// across title, client, ref, assignees and tags.
//
// There is no "assigned to me" parameter. The backend does sort the current
// user's tickets first, then unassigned, then everyone else's — so yours lead
// the list, and `partitionTickets` splits the page already loaded into the
// two cards rather than the app shipping a filter that would only ever see
// the page it had already loaded.
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

    const renderCard = useCallback(() => {
        const { yours, others, othersTotal } = partitionTickets(rows, staff, total);
        // A count with no rows behind it means the rest are still paging in;
        // the card waits rather than reading as an empty section. A genuine
        // zero still shows, so "nothing else open" is stated rather than
        // silently missing.
        const showOthers = others.length > 0 || othersTotal === 0;

        return (
            <View style={{ gap: cardGap }}>
                {yours.length > 0 ? (
                    <Card>
                        <CardHeader title="Yours" meta={yours.length} />
                        {yours.map((item, index) => (
                            <TicketRow key={String(item.id)} ticket={item} index={index} />
                        ))}
                    </Card>
                ) : null}

                {showOthers ? (
                    <Card>
                        <CardHeader title="Everyone else" meta={othersTotal} />
                        {others.map((item, index) => (
                            <TicketRow key={String(item.id)} ticket={item} index={index} />
                        ))}
                    </Card>
                ) : null}
            </View>
        );
    }, [rows, total, staff]);

    return (
        <View style={styles.screen}>
            <View style={styles.controls}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Ticket, client or ref" />
                <Pills options={FILTERS} value={filter} onChange={setFilter} />
            </View>

            <FlatList
                data={rows.length ? CARD : []}
                keyExtractor={(item) => item.key}
                renderItem={renderCard}
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
    footer: { paddingVertical: 16, alignItems: 'center' },
});
