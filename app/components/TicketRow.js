import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../context/ThemeContext';
import Avatar from './Avatar';
import { priorityColor } from '../utils/tickets';
import { relativeTime, ageDays } from '../utils/datetime';

// One ticket inside a card list, laid out like the Qobox student row: avatar,
// copy, chevron, with a divider above every row but the first (the card's
// header band closes the top). The priority dot sits inline just before the
// ticket reference and is the only priority signal; the meta line does not
// repeat it as a word.
//
// `showClient` adds the client's logo and name. The client Tickets tab leaves
// it off, since every row there belongs to the one client already on screen.
export default function TicketRow({ ticket, index, mine = false, showClient = true }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    // "#1234  (27d)": the age in whole days since the ticket was created, the
    // way the web list shows it, two spaces after the reference.
    const age = ageDays(ticket.created_at);
    const ref = `#${ticket.ticket_ref_with_check_digit || ticket.ticket_ref}${age != null ? `  (${age}d)` : ''}`;

    const meta = [
        showClient ? ticket.client_name : null,
        relativeTime(ticket.latest_action || ticket.created_at),
    ].filter(Boolean).join(' · ');

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/ticket/${ticket.id}`)}
            style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
        >
            {showClient ? (
                <Avatar uri={ticket.client_logo} name={ticket.client_name} id={ticket.client_id} size={40} />
            ) : null}

            <View style={styles.copy}>
                <View style={styles.refRow}>
                    <View style={[styles.dot, { backgroundColor: priorityColor(ticket.priority, colors) }]} />
                    <Text style={[styles.ref, { color: colors.textSecondary }]}>{ref}</Text>
                    {mine ? (
                        <View style={[styles.chip, { backgroundColor: colors.primary + '1A' }]}>
                            <Text style={[styles.chipText, { color: colors.primary }]}>You</Text>
                        </View>
                    ) : null}
                </View>

                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                    {ticket.title}
                </Text>

                <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {meta}
                </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    copy: { flex: 1, gap: 3 },
    refRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    ref: { fontSize: 11, fontWeight: '700' },
    chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginLeft: 2 },
    chipText: { fontSize: 10, fontWeight: '700' },
    title: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
    meta: { fontSize: 12 },
});
