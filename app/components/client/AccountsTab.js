import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import Theme from '../../context/ThemeContext';
import api from '../../services/api';
import Card, { cardGap, CardHeader } from '../Card';
import ScreenState from '../ScreenState';
import { invoiceStatus, isOutstanding, money, mergeInvoices, arrearsFor } from '../../utils/invoices';

const PAGE = 50;

// The list is one card, so the FlatList carries a single item and the card
// draws the rows — the same shape as the tickets list — which keeps
// onEndReached for paging without splitting the card per row.
const CARD = [{ key: 'card' }];

// GET /api/invoices is gated on manage-client-account, which is
// `$user->sysadmin` and nothing else — this tab is only ever rendered for a
// sysadmin, and a 403 here means that gate changed.
//
// Every invoice the client has, paid or not, newest first, fifty at a time
// with the next fifty fetched as the list nears its end. The overdue total
// above the list is the client's arrears as GET /api/clients reports it —
// the figure the web client list shows — rather than a sum of whatever pages
// happen to be loaded.
export default function AccountsTab({ clientId }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [arrears, setArrears] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);

    const inFlight = useRef(false);

    const fetchPage = useCallback(async (nextPage, mode) => {
        if (inFlight.current && mode === 'more') return;

        inFlight.current = true;

        if (mode === 'more') setLoadingMore(true);
        else if (mode === 'refresh') setRefreshing(true);
        else setLoading(true);

        setError(null);

        try {
            const response = await api.clientInvoices(clientId, { page: nextPage, limit: PAGE });
            const fresh = Array.isArray(response?.invoices) ? response.invoices : [];

            setRows((prev) => (nextPage > 1 ? mergeInvoices(prev, fresh) : fresh));
            setTotal(Number(response?.total) || 0);
            setPage(nextPage);
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            inFlight.current = false;
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [clientId]);

    // A failed lookup leaves the figure blank rather than showing a partial sum.
    const fetchArrears = useCallback(async () => {
        try {
            setArrears(arrearsFor(await api.clients(), clientId));
        } catch {
            setArrears(null);
        }
    }, [clientId]);

    useEffect(() => {
        fetchPage(1, 'initial');
        fetchArrears();
    }, [fetchPage, fetchArrears]);

    const refresh = useCallback(() => {
        fetchPage(1, 'refresh');
        fetchArrears();
    }, [fetchPage, fetchArrears]);

    const loadMore = useCallback(() => {
        if (loading || loadingMore || rows.length >= total) return;

        fetchPage(page + 1, 'more');
    }, [loading, loadingMore, rows.length, total, page, fetchPage]);

    const tones = { success: colors.success, error: colors.error, muted: colors.textSecondary };

    const renderCard = useCallback(() => (
        <View style={{ gap: cardGap }}>
            <Card style={styles.summary}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Overdue</Text>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                    {arrears == null ? '—' : money(arrears)}
                </Text>
            </Card>

            <Card>
                <CardHeader
                    title="Invoices"
                    meta={rows.length < total ? `${rows.length} of ${total}` : total}
                />
                {rows.map((item, index) => {
                    const status = invoiceStatus(item);
                    const outstanding = isOutstanding(item);

                    return (
                        <View
                            key={String(item.invoice_id ?? index)}
                            style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                        >
                            <View style={styles.copy}>
                                <Text style={[styles.ref, { color: colors.textPrimary }]} numberOfLines={1}>
                                    {item.xero_invoice_no || item.invoice_id || '—'}
                                </Text>
                                {item.reference ? (
                                    <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {item.reference}
                                    </Text>
                                ) : null}
                                <Text style={[styles.meta, { color: tones[status.tone] }]}>
                                    {status.label}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.amount,
                                    { color: outstanding ? colors.textPrimary : colors.textSecondary },
                                ]}
                            >
                                {money(item.total_with_gst)}
                            </Text>
                        </View>
                    );
                })}
            </Card>
        </View>
    ), [rows, total, arrears, colors, tones]);

    return (
        <FlatList
            data={rows.length ? CARD : []}
            keyExtractor={(item) => item.key}
            renderItem={renderCard}
            contentContainerStyle={styles.list}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
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
                    emptyText="No invoices"
                    onRetry={() => fetchPage(1, 'initial')}
                />
            }
        />
    );
}

const styles = StyleSheet.create({
    list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: cardGap, flexGrow: 1 },
    summary: { padding: 16, gap: 2 },
    summaryLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    summaryValue: { fontSize: 24, fontWeight: '700' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
    copy: { flex: 1, gap: 2 },
    ref: { fontSize: 14, fontWeight: '700' },
    meta: { fontSize: 12 },
    amount: { fontSize: 15, fontWeight: '700' },
    footer: { paddingVertical: 16, alignItems: 'center' },
});
