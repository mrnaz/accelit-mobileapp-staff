import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import RenderHtml from 'react-native-render-html';
import Theme from '../context/ThemeContext';
import api from '../services/api';
import DetailHeader from '../components/DetailHeader';
import ScreenState from '../components/ScreenState';
import Card, { cardGap, CardHeader, cardBodyPadding } from '../components/Card';
import LabelValue from '../components/LabelValue';
import ContactRow from '../components/ContactRow';
import { priorityColor, priorityLabel } from '../utils/tickets';
import { dateTime, relativeTime } from '../utils/datetime';

export default function TicketPage() {
    const { id } = useLocalSearchParams();
    const { useTheme } = Theme;
    const { theme, mode } = useTheme();
    const { colors } = theme;
    const { width } = useWindowDimensions();

    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [denied, setDenied] = useState(false);

    const load = useCallback(async ({ refresh = false } = {}) => {
        if (refresh) setRefreshing(true); else setLoading(true);
        setError(null);
        setDenied(false);

        try {
            setTicket(await api.ticket(id));
        } catch (err) {
            if (err.status === 403) setDenied(true);
            else if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const reporter = useMemo(() => {
        const users = Array.isArray(ticket?.affected_users) ? ticket.affected_users : [];

        return users.find((u) => u.reporter) || users[0] || null;
    }, [ticket]);

    // Ticket bodies are Tiptap HTML stored without sanitisation and rendered
    // with v-html on the web. react-native-render-html does not execute script,
    // and media hrefs arrive already signed from the backend.
    const htmlStyles = useMemo(() => ({
        baseStyle: { color: colors.textPrimary, fontSize: 14, lineHeight: 21 },
        tagsStyles: {
            a: { color: colors.primary },
            p: { marginTop: 0, marginBottom: 10 },
            li: { marginBottom: 4 },
        },
    }), [colors]);

    const body = ticket?.body?.trim();

    return (
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <StatusBar style={mode === 'light' ? 'dark' : 'light'} />

            <DetailHeader
                title={ticket ? `#${ticket.ticket_ref_with_check_digit || ticket.ticket_ref}` : 'Ticket'}
                subtitle={ticket?.client?.name}
                fallback="/(main)/tickets"
            />

            {loading || error || denied ? (
                <ScreenState
                    loading={loading}
                    error={error}
                    empty={!loading && !error && denied}
                    emptyText="You do not have access to this ticket"
                    emptyIcon="lock-closed-outline"
                    onRetry={load}
                />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => load({ refresh: true })}
                            tintColor={colors.primary}
                        />
                    }
                >
                    <Card>
                        <CardHeader>
                            <View style={styles.headerRow}>
                                <View
                                    style={[styles.dot, { backgroundColor: priorityColor(ticket?.priority, colors) }]}
                                />
                                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={3}>
                                    {ticket?.title}
                                </Text>
                            </View>
                        </CardHeader>

                        <View style={styles.inner}>
                            <LabelValue label="Status" value={ticket?.completed_at ? 'Completed' : 'Open'} />
                            <LabelValue label="Priority" value={priorityLabel(ticket?.priority)} />
                            <LabelValue label="Client" value={ticket?.client?.name} />
                            <LabelValue label="Created" value={dateTime(ticket?.created_at)} />
                            <LabelValue
                                label="Updated"
                                value={relativeTime(ticket?.updated_at)}
                                last={!ticket?.completed_at}
                            />
                            {ticket?.completed_at ? (
                                <LabelValue label="Completed" value={dateTime(ticket.completed_at)} last />
                            ) : null}
                        </View>
                    </Card>

                    {reporter ? (
                        <Card>
                            <CardHeader title="Reported by" />
                            <View style={styles.inner}>
                                <ContactRow
                                    name={reporter.name
                                        || `${reporter.fname || ''} ${reporter.sname || ''}`.trim()
                                        || 'Unknown'}
                                    subtitle={reporter.position}
                                    phone={reporter.phone}
                                    email={reporter.email}
                                />
                            </View>
                        </Card>
                    ) : null}

                    <Card>
                        <CardHeader title="Description" />
                        <View style={styles.inner}>
                            {body ? (
                                <RenderHtml
                                    contentWidth={width - 64}
                                    source={{ html: body }}
                                    baseStyle={htmlStyles.baseStyle}
                                    tagsStyles={htmlStyles.tagsStyles}
                                    enableExperimentalMarginCollapsing
                                />
                            ) : (
                                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                                    No description
                                </Text>
                            )}
                        </View>
                    </Card>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    scroll: { padding: 16, gap: cardGap },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
    dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
    headerTitle: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 20 },
    inner: { ...cardBodyPadding },
});
