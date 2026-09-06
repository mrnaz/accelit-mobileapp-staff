import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import Theme from '../../context/ThemeContext';
import api from '../../services/api';
import Card, { CardHeader, cardGap } from '../Card';
import TicketRow from '../TicketRow';
import ScreenState from '../ScreenState';
import Pills from '../Pills';

const FILTERS = [
    { value: 'open', label: 'Open' },
    { value: 'done', label: 'Completed' },
];

// One card holding every row, like the Qobox student list. Rows come from the
// shared TicketRow without the client avatar: every ticket here belongs to
// the client whose page this is.
const CARD = [{ key: 'client-tickets-card' }];

export default function TicketsTab({ clientId }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('open');

    const load = useCallback(async ({ refresh = false } = {}) => {
        if (refresh) setRefreshing(true); else setLoading(true);
        setError(null);

        try {
            const response = await api.clientTickets(clientId, { completed: filter === 'done', limit: 100 });

            setRows(Array.isArray(response?.tickets) ? response.tickets : []);
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [clientId, filter]);

    useEffect(() => { load(); }, [load]);

    const renderCard = useCallback(() => (
        <Card>
            <CardHeader title={filter === 'done' ? 'Completed' : 'Open'} meta={rows.length} />
            {rows.map((item, index) => (
                <TicketRow key={String(item.id)} ticket={item} index={index} showClient={false} />
            ))}
        </Card>
    ), [rows, filter]);

    return (
        <View style={styles.wrap}>
            <View style={styles.controls}>
                <Pills options={FILTERS} value={filter} onChange={setFilter} />
            </View>

            <FlatList
                data={rows.length ? CARD : []}
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
                        emptyText={filter === 'done' ? 'Nothing completed' : 'No open tickets'}
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
});
