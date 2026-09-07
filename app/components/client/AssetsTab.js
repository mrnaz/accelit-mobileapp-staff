import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import Theme from '../../context/ThemeContext';
import api from '../../services/api';
import Card, { cardGap } from '../Card';
import ScreenState from '../ScreenState';
import SearchField from '../SearchField';
import useDebounced from '../../utils/useDebounced';

// Scoped by the client_id QUERY parameter. The clients/{client}/assets path
// segment is ignored by the controller, so passing it alone would return every
// asset the staff member can reach — see gap 5 in docs/api-contract.md.
export default function AssetsTab({ clientId, onCount }) {
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
            const response = await api.clientAssets(clientId, { limit: 200 });
            const list = Array.isArray(response) ? response : response?.data;

            setRows(Array.isArray(list) ? list : []);
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [clientId]);

    useEffect(() => { load(); }, [load]);

    // Everything the client owns, not what the search box has narrowed it to:
    // the tab bar reports the list, the search only sifts it. An errored list
    // reports nothing rather than zero.
    useEffect(() => {
        if (!loading && !error) onCount?.(rows.length);
    }, [loading, error, rows, onCount]);

    const visible = term
        ? rows.filter((a) => `${a.name || ''} ${a.serial || ''} ${a.model || ''}`
            .toLowerCase().includes(term))
        : rows;

    return (
        <View style={styles.wrap}>
            <View style={styles.controls}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Name, serial or model" />
            </View>

            <FlatList
                data={visible}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <Card style={styles.card}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                            {item.name || item.hostname || 'Unnamed asset'}
                        </Text>
                        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={2}>
                            {[item.type, item.model, item.serial ? `SN ${item.serial}` : null]
                                .filter(Boolean).join(' · ') || '—'}
                        </Text>
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
                        emptyText={term ? 'No asset matches that' : 'No assets recorded'}
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
    card: { padding: 12, gap: 3 },
    name: { fontSize: 15, fontWeight: '700' },
    meta: { fontSize: 12 },
});
