import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../context/ThemeContext';
import api from '../services/api';
import Card, { cardGap } from '../components/Card';
import ScreenState from '../components/ScreenState';
import SearchField from '../components/SearchField';
import Pills from '../components/Pills';
import useDebounced from '../utils/useDebounced';

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

    const renderItem = useCallback(({ item }) => {
        const suburb = item.primary_site?.address?.suburbcity;
        const open = Number(item.open_tickets) || 0;

        return (
            <Card onPress={() => router.push(`/client/${item.id}`)} style={styles.card}>
                <View style={styles.row}>
                    {item.logo ? (
                        <Image source={{ uri: item.logo }} style={styles.logo} resizeMode="contain" />
                    ) : (
                        <View style={[styles.logo, styles.logoFallback, { backgroundColor: colors.primary + '1A' }]}>
                            <Text style={{ color: colors.primary, fontWeight: '700' }}>
                                {(item.name || '?')[0].toUpperCase()}
                            </Text>
                        </View>
                    )}

                    <View style={styles.copy}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                            {[suburb, item.status === 'inactive' ? 'Inactive' : null]
                                .filter(Boolean).join(' · ') || '—'}
                        </Text>
                    </View>

                    {open > 0 ? (
                        <View style={[styles.badge, { backgroundColor: colors.primary + '1A' }]}>
                            <Text style={[styles.badgeText, { color: colors.primary }]}>{open}</Text>
                        </View>
                    ) : null}

                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </View>
            </Card>
        );
    }, [colors]);

    return (
        <View style={styles.screen}>
            <View style={styles.controls}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Client or suburb" />
                <Pills options={FILTERS} value={filter} onChange={setFilter} />
            </View>

            <FlatList
                data={visible}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
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
    card: { padding: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logo: { width: 40, height: 40, borderRadius: 8 },
    logoFallback: { alignItems: 'center', justifyContent: 'center' },
    copy: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontWeight: '700' },
    meta: { fontSize: 12 },
    badge: { minWidth: 26, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, alignItems: 'center' },
    badgeText: { fontSize: 12, fontWeight: '700' },
});
