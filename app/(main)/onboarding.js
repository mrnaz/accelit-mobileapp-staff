import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, SectionList, RefreshControl, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../context/ThemeContext';
import api from '../services/api';
import { CardHeader } from '../components/Card';
import SectionLabel from '../components/SectionLabel';
import ScreenState from '../components/ScreenState';
import SearchField from '../components/SearchField';
import useDebounced from '../utils/useDebounced';
import { groupByClient, machineMeta } from '../utils/onboarding';

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

    const sections = useMemo(
        () => groupByClient(visible).map((group, index) => ({
            title: group.client,
            // The first group sits under the header band, which already draws
            // its own bottom border.
            first: index === 0,
            data: group.items,
        })),
        [visible],
    );

    // The list still reads as one card, but the card is assembled from the
    // list's own chrome rather than wrapping the rows in a <Card>: this
    // endpoint returns one record per machine for every client, unpaginated,
    // so a mapped card mounts the lot in one pass. The header carries the top
    // corners and the top border, each row and group label the sides, the
    // footer the bottom. The card's shadow is dropped — stacked views cannot
    // cast one shadow between them.
    const edge = useMemo(() => ({
        backgroundColor: colors.cardBackground,
        borderColor: colors.borderStrong || colors.border,
    }), [colors]);

    const renderSectionHeader = useCallback(({ section }) => (
        <SectionLabel
            style={[
                styles.groupLabel,
                {
                    backgroundColor: edge.backgroundColor,
                    borderLeftColor: edge.borderColor,
                    borderRightColor: edge.borderColor,
                },
                !section.first && { borderTopWidth: 1, borderTopColor: colors.border },
            ]}
        >
            {section.title}
        </SectionLabel>
    ), [colors, edge]);

    const renderRow = useCallback(({ item, index }) => (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/onboarding/${item.id}`)}
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
    ), [colors, edge]);

    return (
        <View style={styles.screen}>
            <View style={styles.controls}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Computer, old name or client" />
            </View>

            <SectionList
                sections={sections}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderRow}
                renderSectionHeader={renderSectionHeader}
                stickySectionHeadersEnabled={false}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => load({ refresh: true })}
                        tintColor={colors.primary}
                    />
                }
                ListHeaderComponent={sections.length ? (
                    <View style={[styles.cardTop, edge]}>
                        <CardHeader title="Machines" meta={visible.length} />
                    </View>
                ) : null}
                ListFooterComponent={sections.length ? <View style={[styles.cardBottom, edge]} /> : null}
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
    groupLabel: {
        paddingTop: 10, paddingHorizontal: 16, paddingBottom: 4,
        borderLeftWidth: 1, borderRightWidth: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderLeftWidth: 1,
        borderRightWidth: 1,
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
