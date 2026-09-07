import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../context/ThemeContext';
import api from '../services/api';
import { CardHeader } from '../components/Card';
import Avatar from '../components/Avatar';
import ScreenState from '../components/ScreenState';
import SearchField from '../components/SearchField';
import Pills from '../components/Pills';
import useDebounced from '../utils/useDebounced';
import { clientMeta } from '../utils/clients';

const FILTERS = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'all', label: 'All' },
];

// GET /api/clients returns a BARE ARRAY, every accessible client in one
// response, with no pagination and a `search` parameter the backend ignores.
// So the app fetches once and filters locally — the same thing the web SPA
// does with the same endpoint.
export default function Clients() {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('active');

    const term = useDebounced(search, 200).trim().toLowerCase();

    const load = useCallback(async ({ refresh = false } = {}) => {
        if (refresh) setRefreshing(true); else setLoading(true);
        setError(null);

        try {
            // No filter argument: the backend excludes leads by default, and
            // status filtering happens locally so the pills do not re-fetch.
            const data = await api.clients();

            setRows(Array.isArray(data) ? data : []);
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const visible = useMemo(() => {
        let list = rows;

        if (filter !== 'all') list = list.filter((c) => c.status === filter);

        if (term) {
            list = list.filter((c) => {
                const suburb = c.primary_site?.address?.suburbcity || '';

                return `${c.name || ''} ${suburb}`.toLowerCase().includes(term);
            });
        }

        return list;
    }, [rows, filter, term]);

    // The list still reads as one card, but the card is assembled from the
    // list's own chrome rather than wrapping the rows in a <Card>: this
    // endpoint is unpaginated, so a mapped card mounts every accessible client
    // in one pass. The header carries the top corners and the top border, each
    // row the sides, the footer the bottom. The card's shadow is dropped —
    // three stacked views cannot cast one shadow between them.
    const edge = useMemo(() => ({
        backgroundColor: colors.cardBackground,
        borderColor: colors.borderStrong || colors.border,
    }), [colors]);

    const renderRow = useCallback(({ item, index }) => (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/client/${item.id}`)}
            style={[
                styles.row,
                {
                    backgroundColor: edge.backgroundColor,
                    borderLeftColor: edge.borderColor,
                    borderRightColor: edge.borderColor,
                },
                index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
            ]}
        >
            <Avatar uri={item.logo} name={item.name} id={item.id} size={40} />

            <View style={styles.copy}>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {clientMeta(item)}
                </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
    ), [colors, edge]);

    return (
        <View style={styles.screen}>
            <View style={styles.controls}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Client or suburb" />
                <Pills options={FILTERS} value={filter} onChange={setFilter} />
            </View>

            <FlatList
                data={visible}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderRow}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => load({ refresh: true })}
                        tintColor={colors.primary}
                    />
                }
                ListHeaderComponent={visible.length ? (
                    <View style={[styles.cardTop, edge]}>
                        <CardHeader
                            title={FILTERS.find((f) => f.value === filter).label}
                            meta={visible.length}
                        />
                    </View>
                ) : null}
                ListFooterComponent={visible.length ? <View style={[styles.cardBottom, edge]} /> : null}
                ListEmptyComponent={
                    <ScreenState
                        loading={loading && rows.length === 0}
                        error={!loading && rows.length === 0 ? error : null}
                        empty={!loading && !error}
                        emptyText={term || filter !== 'active'
                            ? 'No clients match that'
                            : 'No clients you can access'}
                        onRetry={load}
                    />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    controls: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 10 },
    list: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
    // Radius 16 and the clipped header band are Card's (app/components/Card.js).
    cardTop: {
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
        overflow: 'hidden',
    },
    cardBottom: {
        height: 12,
        borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
        borderBottomWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderLeftWidth: 1,
        borderRightWidth: 1,
    },
    copy: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontWeight: '700' },
    meta: { fontSize: 12 },
});
