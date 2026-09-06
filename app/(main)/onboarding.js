import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../context/ThemeContext';
import api from '../services/api';
import Card, { cardGap } from '../components/Card';
import ScreenState from '../components/ScreenState';
import SearchField from '../components/SearchField';
import useDebounced from '../utils/useDebounced';
import { shortDate } from '../utils/datetime';

// GET /api/assets/onboarding returns {assets: [...]} — the latest record per
// unique computername, unpaginated, with no search parameter. Fetch once,
// filter locally.
//
// Every row also carries a plaintext localadmin_pw. The list deliberately never
// renders it; the detail screen puts it behind an explicit reveal so a password
// is not sitting on screen while the phone is being carried around.
export default function Onboarding() {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    const term = useDebounced(search, 200).trim().toLowerCase();

    const load = useCallback(async ({ refresh = false } = {}) => {
        if (refresh) setRefreshing(true); else setLoading(true);
        setError(null);

        try {
            const response = await api.assetOnboarding();

            setRows(Array.isArray(response?.assets) ? response.assets : []);
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const visible = useMemo(() => {
        if (!term) return rows;

        return rows.filter((r) => {
            const haystack = `${r.computername || ''} ${r.client_name || ''} ${r.prev_computername || ''}`;

            return haystack.toLowerCase().includes(term);
        });
    }, [rows, term]);

    const renderItem = useCallback(({ item }) => (
        <Card onPress={() => router.push(`/onboarding/${item.id}`)} style={styles.card}>
            <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: colors.primary + '1A' }]}>
                    <Ionicons name="laptop-outline" size={18} color={colors.primary} />
                </View>

                <View style={styles.copy}>
                    <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                        {item.computername}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                        {[item.client_name, shortDate(item.created_at)].filter(Boolean).join(' · ') || '—'}
                    </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
        </Card>
    ), [colors]);

    return (
        <View style={styles.screen}>
            <View style={styles.controls}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Computer or client name" />
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
                        emptyText={term ? 'No machine matches that' : 'No onboarding records'}
                        onRetry={load}
                    />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    controls: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
    list: { paddingHorizontal: 16, paddingBottom: 24, gap: cardGap, flexGrow: 1 },
    card: { padding: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    copy: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontWeight: '700' },
    meta: { fontSize: 12 },
});
