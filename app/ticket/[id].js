import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking, useWindowDimensions, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import RenderHtml from 'react-native-render-html';
import Theme from '../context/ThemeContext';
import { useStaff } from '../context/StaffContext';
import api from '../services/api';
import DetailHeader from '../components/DetailHeader';
import ScreenState from '../components/ScreenState';
import Card, { cardGap, CardHeader, cardBodyPadding } from '../components/Card';
import LabelValue from '../components/LabelValue';
import Avatar from '../components/Avatar';
import IconButton from '../components/IconButton';
import { priorityColor, priorityLabel, isMine } from '../utils/tickets';
import { dateTime, relativeTime } from '../utils/datetime';
import { formatPhone, dialUri, mailUri } from '../utils/phone';

export default function TicketPage() {
    const { id } = useLocalSearchParams();
    const { useTheme } = Theme;
    const { theme, mode } = useTheme();
    const { colors } = theme;
    const { width } = useWindowDimensions();
    const { staff } = useStaff();

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

    // The single ticket endpoint carries the reporter inside `affected_users`
    // rather than as flat fields on the ticket itself — the reporter-flagged
    // entry when there is one, else the first affected user.
    const reporter = useMemo(() => {
        const users = Array.isArray(ticket?.affected_users) ? ticket.affected_users : [];

        return users.find((u) => u.reporter) || users[0] || null;
    }, [ticket]);

    const contactName = reporter && (reporter.client_contact_full_name
        || reporter.name
        || `${reporter.fname || ''} ${reporter.sname || ''}`.trim()
        || 'Unknown');
    const contactPosition = reporter?.client_contact_position || reporter?.position;
    const contactPhone = reporter?.client_contact_phone || reporter?.phone;
    const contactEmail = reporter?.client_contact_email || reporter?.email;
    const contactPhoto = reporter?.client_contact_photo || reporter?.photo;
    const contactId = reporter?.client_contact_id || reporter?.id;
    const contactMeta = [contactPosition, formatPhone(contactPhone)].filter(Boolean).join(' · ');
    const contactDial = dialUri(contactPhone);
    const contactMail = mailUri(contactEmail);

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
                    <Card style={styles.summaryCard}>
                        <View style={styles.headerRow}>
                            <View
                                style={[styles.dot, { backgroundColor: priorityColor(ticket?.priority, colors) }]}
                            />
                            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                                {ticket?.title}
                            </Text>
                        </View>

                        <View style={styles.chipRow}>
                            <View style={[styles.chip, { backgroundColor: colors.primary + '1A' }]}>
                                <Text style={[styles.chipText, { color: colors.primary }]}>
                                    {ticket?.completed_at ? 'Completed' : 'Open'}
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.chip,
                                    styles.priorityChip,
                                    { borderColor: priorityColor(ticket?.priority, colors) },
                                ]}
                            >
                                <Text style={[styles.chipText, { color: priorityColor(ticket?.priority, colors) }]}>
                                    {priorityLabel(ticket?.priority)}
                                </Text>
                            </View>

                            {isMine(ticket, staff) ? (
                                <View style={[styles.chip, { backgroundColor: colors.primary + '1A' }]}>
                                    <Text style={[styles.chipText, { color: colors.primary }]}>You</Text>
                                </View>
                            ) : null}

                            <Text style={[styles.updated, { color: colors.textSecondary }]}>
                                {`Updated ${relativeTime(ticket?.updated_at || ticket?.created_at)}`}
                            </Text>
                        </View>
                    </Card>

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

                    {reporter ? (
                        <Card>
                            <CardHeader title="Reported by" />
                            <View style={styles.contactRow}>
                                <Avatar
                                    uri={contactPhoto}
                                    name={contactName}
                                    id={contactId}
                                    size={40}
                                />
                                <View style={styles.contactCopy}>
                                    <Text
                                        style={[styles.contactName, { color: colors.textPrimary }]}
                                        numberOfLines={1}
                                    >
                                        {contactName}
                                    </Text>
                                    {contactMeta ? (
                                        <Text
                                            style={[styles.contactMeta, { color: colors.textSecondary }]}
                                            numberOfLines={1}
                                        >
                                            {contactMeta}
                                        </Text>
                                    ) : null}
                                </View>
                                <View style={styles.contactActions}>
                                    <IconButton
                                        icon="call-outline"
                                        label={`Call ${contactName}`}
                                        disabled={!contactDial}
                                        onPress={() => Linking.openURL(contactDial)}
                                    />
                                    <IconButton
                                        icon="mail-outline"
                                        label={`Email ${contactName}`}
                                        disabled={!contactMail}
                                        onPress={() => Linking.openURL(contactMail)}
                                    />
                                </View>
                            </View>
                        </Card>
                    ) : null}

                    <Card>
                        <CardHeader>
                            <View style={styles.detailsHeaderRow}>
                                <Text style={[styles.detailsTitle, { color: colors.textPrimary }]}>
                                    Details
                                </Text>
                                <TouchableOpacity onPress={() => router.push('/client/' + ticket?.client?.id)}>
                                    <Text style={[styles.detailsMeta, { color: colors.primary }]}>
                                        Open client
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </CardHeader>
                        <View style={styles.inner}>
                            <LabelValue label="Client" value={ticket?.client?.name} />
                            <LabelValue label="Created" value={dateTime(ticket?.created_at)} />
                            <LabelValue
                                label="Assigned"
                                value={ticket?.assignees?.map((a) => a.name)?.join(', ')}
                                last={!ticket?.completed_at}
                            />
                            {ticket?.completed_at ? (
                                <LabelValue label="Completed" value={dateTime(ticket.completed_at)} last />
                            ) : null}
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
    summaryCard: { paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    dot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 6 },
    headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', lineHeight: 21 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
    chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
    priorityChip: { borderWidth: 1, backgroundColor: 'transparent' },
    chipText: { fontSize: 11, fontWeight: '700' },
    updated: { fontSize: 11, fontWeight: '600' },
    inner: { ...cardBodyPadding },
    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, ...cardBodyPadding },
    contactCopy: { flex: 1, gap: 2 },
    contactName: { fontSize: 15, fontWeight: '700' },
    contactMeta: { fontSize: 12 },
    contactActions: { flexDirection: 'row', gap: 8 },
    detailsHeaderRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    detailsTitle: { fontSize: 15, fontWeight: '700' },
    detailsMeta: { fontSize: 13, fontWeight: '600' },
});
