import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import Theme from '../../context/ThemeContext';
import api from '../../services/api';
import Card, { cardGap } from '../Card';
import ScreenState from '../ScreenState';
import { shortDate, parseApiDate } from '../../utils/datetime';

const money = (value) => {
    const n = Number(value);

    return Number.isFinite(n)
        ? n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })
        : '—';
};

// GET /api/invoices is gated on manage-client-account, which is
// `$user->sysadmin` and nothing else — this tab is only ever rendered for a
// sysadmin, and a 403 here means that gate changed.
export default function AccountsTab({ clientId }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async ({ refresh = false } = {}) => {
        if (refresh) setRefreshing(true); else setLoading(true);
        setError(null);

        try {
            const response = await api.clientInvoices(clientId);
            const list = Array.isArray(response?.invoices) ? response.invoices : [];

            // Only what the question needs: what is still owed.
            setRows(list.filter((i) => !i.paid && !i.voided));
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [clientId]);

    useEffect(() => { load(); }, [load]);

    const owing = useMemo(
        () => rows.reduce((sum, i) => sum + (Number(i.total_with_gst) || 0), 0),
        [rows],
    );

    return (
        <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id ?? item.invoice_id)}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
                rows.length ? (
                    <Card style={styles.summary}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Owing</Text>
                        <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{money(owing)}</Text>
                    </Card>
                ) : null
            }
            renderItem={({ item }) => {
                const due = parseApiDate(item.due);
                const overdue = due ? due.isBefore(undefined, 'day') : false;

                return (
                    <Card style={styles.card}>
                        <View style={styles.row}>
                            <View style={styles.copy}>
                                <Text style={[styles.ref, { color: colors.textPrimary }]} numberOfLines={1}>
                                    {item.xero_invoice_no || item.invoice_id || '—'}
                                </Text>
                                {item.reference ? (
                                    <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {item.reference}
                                    </Text>
                                ) : null}
                                <Text style={[styles.meta, { color: overdue ? colors.error : colors.textSecondary }]}>
                                    {overdue ? 'Overdue · ' : 'Due '}{shortDate(item.due) || 'no date'}
                                </Text>
                            </View>
                            <Text style={[styles.amount, { color: colors.textPrimary }]}>
                                {money(item.total_with_gst)}
                            </Text>
                        </View>
                    </Card>
                );
            }}
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
                    emptyText="No unpaid invoices"
                    emptyIcon="checkmark-circle-outline"
                    emptyTint={colors.success}
                    onRetry={load}
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
    card: { padding: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    copy: { flex: 1, gap: 2 },
    ref: { fontSize: 14, fontWeight: '700' },
    meta: { fontSize: 12 },
    amount: { fontSize: 15, fontWeight: '700' },
});
