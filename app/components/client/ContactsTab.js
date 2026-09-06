import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import Theme from '../../context/ThemeContext';
import api from '../../services/api';
import ScreenState from '../ScreenState';
import ContactRow from '../ContactRow';

// Bare array, no pagination. Contacts for one client are a short list.
export default function ContactsTab({ clientId }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async ({ refresh = false } = {}) => {
        if (refresh) setRefreshing(true); else setLoading(true);
        setError(null);

        try {
            const data = await api.clientContacts(clientId);

            setRows(Array.isArray(data) ? data : []);
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [clientId]);

    useEffect(() => { load(); }, [load]);

    return (
        <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
                <ContactRow
                    name={item.name || `${item.fname || ''} ${item.sname || ''}`.trim()}
                    subtitle={item.position}
                    phone={item.phone}
                    email={item.email}
                    badge={item.default_contact ? 'Primary' : null}
                    showDivider={index > 0}
                />
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
                    emptyText="No contacts recorded"
                    onRetry={load}
                />
            }
        />
    );
}

const styles = StyleSheet.create({
    list: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
});
