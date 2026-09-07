import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import Theme from '../../context/ThemeContext';
import api from '../../services/api';
import ScreenState from '../ScreenState';
import PersonRow from '../PersonRow';
import ContactSheet from '../ContactSheet';
import Toast, { useToast } from '../Toast';

// A client contact as the shared person shape, so the row and the sheet read
// one client's contacts exactly the way the address book reads everyone's.
// `clientId` stays null: this list already lives on the client's own page, so
// the sheet has nowhere useful to send you.
export function contactPerson(contact, key) {
    return {
        key,
        name: contact?.name || `${contact?.fname || ''} ${contact?.sname || ''}`.trim(),
        subtitle: contact?.position || null,
        phone: contact?.phone || null,
        email: contact?.email || null,
        isClient: false,
        clientId: null,
        clientName: null,
        avatarId: contact?.id ?? null,
        firstName: contact?.fname || '',
    };
}

// Bare array, no pagination. Contacts for one client are a short list.
//
// The client page fetches that list for the General tab, so `initialRows`
// seeds this one instead of asking for the same contacts again; pull to
// refresh still goes to the API, and `onRows` hands what comes back to the
// page so the seed does not go stale. This tab unmounts on every tab switch,
// so without that a refresh here would be forgotten as soon as you left.
export default function ContactsTab({ clientId, initialRows, onRows, onCount }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const seeded = Array.isArray(initialRows) ? initialRows : null;

    const [rows, setRows] = useState(seeded || []);
    const [loading, setLoading] = useState(!seeded);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [sheetPerson, setSheetPerson] = useState(null);
    const [toast, showToast] = useToast();

    const skipFirstLoad = useRef(!!seeded);

    const load = useCallback(async ({ refresh = false } = {}) => {
        if (refresh) setRefreshing(true); else setLoading(true);
        setError(null);

        try {
            const data = await api.clientContacts(clientId);
            const list = Array.isArray(data) ? data : [];

            setRows(list);
            onRows?.(list);
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [clientId, onRows]);

    useEffect(() => {
        if (skipFirstLoad.current) {
            skipFirstLoad.current = false;

            return;
        }

        load();
    }, [load]);

    // One place reports the count, so the seeded list and a fetched one both
    // reach the tab bar. An errored list reports nothing rather than zero.
    useEffect(() => {
        if (!loading && !error) onCount?.(rows.length);
    }, [loading, error, rows, onCount]);

    return (
        <View style={styles.wrap}>
            <FlatList
                data={rows}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.list}
                renderItem={({ item, index }) => {
                    const person = contactPerson(item, `contact-${item.id}`);

                    return (
                        <PersonRow
                            person={person}
                            onPress={() => setSheetPerson(person)}
                            showDivider={index > 0}
                            badge={item.default_contact ? 'Primary' : null}
                        />
                    );
                }}
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
                        emptyText="No contacts recorded"
                        onRetry={load}
                    />
                }
            />

            <ContactSheet
                person={sheetPerson}
                visible={!!sheetPerson}
                onClose={() => setSheetPerson(null)}
                onCopied={showToast}
            />

            <Toast message={toast} />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1 },
    list: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
});
