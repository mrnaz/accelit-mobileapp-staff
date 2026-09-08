import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, FlatList, SectionList, TouchableOpacity, RefreshControl, StyleSheet,
} from 'react-native';
import Theme from '../context/ThemeContext';
import api from '../services/api';
import ScreenState from '../components/ScreenState';
import SearchField from '../components/SearchField';
import SectionLabel from '../components/SectionLabel';
import PersonRow from '../components/PersonRow';
import ContactSheet from '../components/ContactSheet';
import useDebounced from '../utils/useDebounced';
import { toPerson, sectionize, matches } from '../utils/addressBook';

// GET /api/address-book returns a BARE ARRAY of three interleaved row types —
// client_contact, general_contact and client — with no pagination and no
// server-side search, so the app fetches once and filters locally.
//
// The list is a phone book: letter sections with a rail down the side while
// browsing, one flat filtered list while searching. Tapping anyone opens the
// contact sheet.
export default function AddressBook() {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [sheetPerson, setSheetPerson] = useState(null);

    const listRef = useRef(null);

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

    const visible = useMemo(
        () => (term ? rows.filter((row) => matches(row, term)) : rows),
        [rows, term],
    );

    const sections = useMemo(() => sectionize(rows), [rows]);

    const showRail = !term && sections.length >= 2;

    const renderItem = useCallback(({ item, index }) => {
        const person = toPerson(item);

        return (
            <PersonRow
                person={person}
                onPress={() => setSheetPerson(person)}
                showDivider={index > 0}
            />
        );
    }, []);

    const renderSectionHeader = useCallback(({ section }) => (
        <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
            <SectionLabel>{section.title}</SectionLabel>
        </View>
    ), [colors.background]);

    const keyFor = useCallback(
        (item, index) => `${item.type}-${item.contact_id ?? item.client_id ?? 'x'}-${index}`,
        [],
    );

    // A section that has never been rendered has no measured offset, so the
    // list estimates one rather than refusing to move.
    const onScrollToIndexFailed = useCallback((info) => {
        listRef.current?.getScrollResponder()?.scrollTo({
            y: (info.averageItemLength || 0) * info.index,
            animated: true,
        });
    }, []);

    const refreshControl = (
        <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load({ refresh: true })}
            tintColor={colors.primary}
        />
    );

    const emptyState = (
        <ScreenState
            loading={loading && rows.length === 0}
            error={!loading && rows.length === 0 ? error : null}
            empty={!loading && !error}
            emptyText={term ? 'Nobody matches that' : 'No contacts'}
            onRetry={load}
        />
    );

    return (
        <View style={styles.screen}>
            <View style={styles.controls}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Name, company, number" />
            </View>

            <View style={styles.body}>
                {term ? (
                    <FlatList
                        data={visible}
                        keyExtractor={keyFor}
                        renderItem={renderItem}
                        contentContainerStyle={styles.list}
                        refreshControl={refreshControl}
                        ListHeaderComponent={
                            visible.length ? (
                                <SectionLabel style={styles.count}>
                                    {visible.length} {visible.length === 1 ? 'match' : 'matches'}
                                </SectionLabel>
                            ) : null
                        }
                        ListEmptyComponent={emptyState}
                        style={styles.flat}
                    />
                ) : (
                    <SectionList
                        ref={listRef}
                        sections={sections}
                        keyExtractor={keyFor}
                        renderItem={renderItem}
                        renderSectionHeader={renderSectionHeader}
                        stickySectionHeadersEnabled
                        onScrollToIndexFailed={onScrollToIndexFailed}
                        contentContainerStyle={[styles.list, showRail && styles.listWithRail]}
                        refreshControl={refreshControl}
                        ListEmptyComponent={emptyState}
                        style={styles.flat}
                    />
                )}

                {showRail ? (
                    <View style={styles.rail} pointerEvents="box-none">
                        {sections.map((section, sectionIndex) => (
                            <TouchableOpacity
                                key={section.title}
                                onPress={() => listRef.current?.scrollToLocation({
                                    sectionIndex, itemIndex: 0, animated: true,
                                })}
                                style={styles.railTouch}
                                accessibilityRole="button"
                                accessibilityLabel={`Jump to ${section.title}`}
                            >
                                <Text style={[styles.railLetter, { color: colors.primary }]}>
                                    {section.title}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : null}
            </View>

            <ContactSheet
                person={sheetPerson}
                visible={!!sheetPerson}
                onClose={() => setSheetPerson(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    controls: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
    body: { flex: 1 },
    flat: { flex: 1 },
    list: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
    listWithRail: { paddingRight: 30 },
    count: { paddingBottom: 4 },
    sectionHeader: { paddingTop: 8, paddingBottom: 4 },

    rail: { position: 'absolute', right: 2, top: 0, bottom: 0, justifyContent: 'center' },
    railTouch: { paddingHorizontal: 6 },
    railLetter: { fontSize: 10, fontWeight: '700', lineHeight: 12 },
});
