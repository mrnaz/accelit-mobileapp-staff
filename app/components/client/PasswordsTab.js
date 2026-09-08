import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import Theme from '../../context/ThemeContext';
import api from '../../services/api';
import Card, { cardGap } from '../Card';
import ScreenState from '../ScreenState';
import RevealField from '../RevealField';

// GET /api/clients/{client}/passwords returns an OBJECT KEYED BY PASSWORD ID,
// not an array — and returns a bare [] for both "this client has none" and
// "the Hudu integration failed", which the app cannot tell apart.
//
// Every row already carries its plaintext password, so revealing is a local
// toggle rather than a second request. The list itself never renders one.
export default function PasswordsTab({ clientId }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const [raw, setRaw] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async ({ refresh = false } = {}) => {
        if (refresh) setRefreshing(true); else setLoading(true);
        setError(null);

        try {
            setRaw(await api.clientPasswords(clientId));
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [clientId]);

    useEffect(() => { load(); }, [load]);

    const rows = useMemo(() => {
        if (!raw || Array.isArray(raw)) return [];

        return Object.values(raw).filter((entry) => entry && entry.id != null);
    }, [raw]);

    return (
        <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
                <Card style={styles.card}>
                    <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>
                        {item.name || 'Untitled'}
                    </Text>
                    {item.username ? (
                        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.username}
                        </Text>
                    ) : null}

                    <View style={styles.field}>
                        <RevealField label="Password" value={item.password ?? '—'} showLabel={false} />
                    </View>

                    {item.otp ? (
                        <View style={styles.field}>
                            <RevealField label="One-time code" value={item.otp} />
                            <Text style={[styles.note, { color: colors.textSecondary }]}>
                                Generated when this list loaded — pull to refresh for a current code.
                            </Text>
                        </View>
                    ) : null}
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
                    emptyText="No passwords available for this client"
                    onRetry={load}
                />
            }
        />
    );
}

const styles = StyleSheet.create({
    list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: cardGap, flexGrow: 1 },
    card: { padding: 14, gap: 4 },
    name: { fontSize: 15, fontWeight: '700' },
    meta: { fontSize: 12 },
    field: { marginTop: 10 },
    note: { fontSize: 11, marginTop: 6 },
});
