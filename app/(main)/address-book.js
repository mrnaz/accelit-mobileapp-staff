import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import Theme from '../context/ThemeContext';
import api from '../services/api';
import ScreenState from '../components/ScreenState';
import SearchField from '../components/SearchField';
import ContactRow from '../components/ContactRow';
import useDebounced from '../utils/useDebounced';

// GET /api/address-book returns a BARE ARRAY of three interleaved row types —
// client_contact, general_contact and client — with no pagination and no
// server-side search, so the app fetches once and filters locally.
export default function AddressBook() {
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
            const data = await api.addressBook();

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
        if (!term) return rows;

        return rows.filter((r) => {
            const haystack = `${r.displayname || ''} ${r.client_name || ''} ${r.email || ''} ${r.phone || ''}`;

            return haystack.toLowerCase().includes(term);
        });
    }, [rows, term]);

    const renderItem = useCallback(({ item, index }) => (
        <ContactRow
            name={item.displayname}
            subtitle={item.type === 'client' ? 'Main line' : item.client_name || 'General contact'}
            phone={item.phone}
            email={item.email}
            badge={item.type === 'client' ? 'Client' : null}
            showDivider={index > 0}
        />
    ), []);

    const keyFor = useCallback(
        (item, index) => `${item.type}-${item.contact_id ?? item.client_id ?? 'x'}-${index}`,
        [],
    );

    return (
        <View style={styles.screen}>
            <View style={styles.controls}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Name, company, number" />
            </View>

            <FlatList
                data={visible}
                keyExtractor={keyFor}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => load({ refresh: true })}
                        tintColor={colors.primary}
                    />
                }
                ListHeaderComponent={
                    visible.length ? (
                        <Text style={[styles.count, { color: colors.textSecondary }]}>
                            {visible.length} {visible.length === 1 ? 'contact' : 'contacts'}
                        </Text>
                    ) : null
                }
                ListEmptyComponent={
                    <ScreenState
                        loading={loading && rows.length === 0}
                        error={!loading && rows.length === 0 ? error : null}
                        empty={!loading && !error}
                        emptyText={term ? 'Nobody matches that' : 'No contacts'}
                        onRetry={load}
                    />
                }
                style={styles.flat}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    controls: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
    flat: { flex: 1 },
    list: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
    count: {
        fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: 0.5, paddingBottom: 4,
    },
});
