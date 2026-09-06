import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../context/ThemeContext';
import api from '../services/api';
import Card, { CardHeader, cardGap } from '../components/Card';
import SectionLabel from '../components/SectionLabel';
import ScreenState from '../components/ScreenState';
import SearchField from '../components/SearchField';
import useDebounced from '../utils/useDebounced';
import { groupByClient, machineMeta } from '../utils/onboarding';

// The list is one card, grouped by client, like the Qobox student list: a
// header band with the total, then each client's machines under its own
// label row. The FlatList carries that single card so pull-to-refresh keeps
// working.
const CARD = [{ key: 'onboarding-card' }];

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

    const groups = useMemo(() => groupByClient(visible), [visible]);

    const renderCard = useCallback(() => (
        <Card>
            <CardHeader title="Machines" meta={visible.length} />

            {groups.map((group, groupIndex) => (
                <React.Fragment key={group.client}>
                    <SectionLabel
                        style={[
                            styles.groupLabel,
                            groupIndex > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                        ]}
                    >
                        {group.client}
                    </SectionLabel>

                    {group.items.map((item) => (
                        <TouchableOpacity
                            key={String(item.id)}
                            activeOpacity={0.85}
                            onPress={() => router.push(`/onboarding/${item.id}`)}
                            style={styles.row}
                        >
                            <View style={[styles.iconWrap, { backgroundColor: colors.primary + '1A' }]}>
                                <Ionicons name="laptop-outline" size={18} color={colors.primary} />
                            </View>

                            <View style={styles.copy}>
                                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                                    {item.computername}
                                </Text>
                                <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {machineMeta(item)}
                                </Text>
                            </View>

                            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    ))}
                </React.Fragment>
            ))}
        </Card>
    ), [groups, visible.length, colors]);

    return (
        <View style={styles.screen}>
            <View style={styles.controls}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Computer, old name or client" />
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
    groupLabel: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 4 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    copy: { flex: 1, gap: 2 },
    name: {
        fontSize: 15,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        letterSpacing: 0.2,
    },
    meta: { fontSize: 12 },
});
