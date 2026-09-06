import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../context/ThemeContext';
import api from '../services/api';
import Card, { CardHeader, cardGap } from '../components/Card';
import Avatar from '../components/Avatar';
import IconButton from '../components/IconButton';
import ScreenState from '../components/ScreenState';
import SearchField from '../components/SearchField';
import Pills from '../components/Pills';
import useDebounced from '../utils/useDebounced';
import { clientMeta } from '../utils/clients';
import { dialUri } from '../utils/phone';

const FILTERS = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'all', label: 'All' },
];

// The list is one card, like the tickets tab: a header band with the filter
// and the total, then every row separated by dividers. The FlatList carries
// that single card so pull-to-refresh keeps working.
const CARD = [{ key: 'clients-card' }];

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

    // GET /api/clients does not return `phone` on list rows (only the client
    // detail endpoint does), so the call button is always dimmed here rather
    // than dialling a number nobody sent.
    const callUri = dialUri(null);

    const renderCard = useCallback(() => (
        <Card>
            <CardHeader title={FILTERS.find((f) => f.value === filter).label} meta={visible.length} />
            {visible.map((item, index) => (
                <TouchableOpacity
                    key={String(item.id)}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/client/${item.id}`)}
                    style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
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

                    <IconButton
                        icon="call-outline"
                        label={`Call ${item.name}`}
                        disabled={!callUri}
                        onPress={() => Linking.openURL(callUri)}
                    />

                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
            ))}
        </Card>
    ), [visible, filter, colors, callUri]);

    return (
        <View style={styles.screen}>
            <View style={styles.controls}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Client or suburb" />
                <Pills options={FILTERS} value={filter} onChange={setFilter} />
            </View>

            <FlatList
                data={visible.length ? CARD : []}
                keyExtractor={(item) => item.key}
                renderItem={renderCard}
                contentContainerStyle={styles.list}
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
    list: { paddingHorizontal: 16, paddingBottom: 24, gap: cardGap, flexGrow: 1 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    copy: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontWeight: '700' },
    meta: { fontSize: 12 },
});
