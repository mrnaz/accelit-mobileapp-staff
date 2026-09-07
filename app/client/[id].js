import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import Theme from '../context/ThemeContext';
import { useStaff } from '../context/StaffContext';
import api from '../services/api';
import Avatar from '../components/Avatar';
import DetailHeader from '../components/DetailHeader';
import ScreenState from '../components/ScreenState';
import { visibleTabs } from '../utils/clientTabs';
import { addressLine } from '../utils/address';
import { mapsUri } from '../utils/maps';
import { dialUri, mailUri } from '../utils/phone';
import GeneralTab from '../components/client/GeneralTab';
import ContactsTab from '../components/client/ContactsTab';
import TicketsTab from '../components/client/TicketsTab';
import AssetsTab from '../components/client/AssetsTab';
import PasswordsTab from '../components/client/PasswordsTab';
import AccountsTab from '../components/client/AccountsTab';

const TAB_BODIES = {
    general: GeneralTab,
    contacts: ContactsTab,
    tickets: TicketsTab,
    assets: AssetsTab,
    passwords: PasswordsTab,
    accounts: AccountsTab,
};

export default function ClientPage() {
    const { id } = useLocalSearchParams();
    const { useTheme } = Theme;
    const { theme, mode } = useTheme();
    const { colors } = theme;
    const { staff } = useStaff();

    const [client, setClient] = useState(null);
    const [contacts, setContacts] = useState(null);
    const [accessLevel, setAccessLevel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [denied, setDenied] = useState(false);
    const [active, setActive] = useState(null);
    const [counts, setCounts] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setDenied(false);

        try {
            // Cheap pre-flight: it reports "none" rather than 403ing, so the app
            // learns it cannot open the client without a failed request first.
            const access = await api.clientAccessLevel(id);

            setAccessLevel(access?.access_level ?? 'none');

            if (!access?.can_access || access?.access_level === 'none') {
                setDenied(true);

                return;
            }

            setClient(await api.client(id));
        } catch (err) {
            if (err.status === 403) setDenied(true);
            else if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const tabs = useMemo(() => visibleTabs(accessLevel, staff), [accessLevel, staff]);

    // Seeded from the derived list rather than hardcoded, because the first tab
    // can differ by access level.
    useEffect(() => {
        if (!active && tabs.length) setActive(tabs[0].id);
        if (active && tabs.length && !tabs.some((t) => t.id === active)) setActive(tabs[0].id);
    }, [tabs, active]);

    // 'limited' access has no Contacts tab, and the web hides a client's
    // contacts entirely at that level, so the page must not ask for them —
    // which also keeps the General tab from offering a switch to a tab that
    // does not exist. Read off the same list the tab bar draws.
    const showsContacts = useMemo(() => tabs.some((tab) => tab.id === 'contacts'), [tabs]);

    // The General tab names the primary contact and the Contacts tab is seeded
    // from the same list, so it is fetched once, here, rather than by both.
    // Errors are ignored: the Contacts tab still fetches for itself.
    useEffect(() => {
        if (!client || !showsContacts) return;

        api.clientContacts(id)
            .then((data) => setContacts(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, [client, showsContacts, id]);

    const showContacts = useCallback(() => setActive('contacts'), []);

    // The Contacts tab hands its fetched list back, so the snapshot a remount
    // re-seeds from is the newest one — otherwise a pull-to-refresh there would
    // be undone by the next tab switch.
    const onRows = useCallback((rows) => setContacts(rows), []);

    // Only the active tab is mounted, so one callback bound to it is enough.
    // Ignoring an unchanged count keeps a tab that re-reports from looping.
    const onCount = useCallback((n) => {
        setCounts((prev) => (prev[active] === n ? prev : { ...prev, [active]: n }));
    }, [active]);

    const Body = active ? TAB_BODIES[active] : null;

    // What the mounted tab needs beyond the client itself. The General tab is
    // given the contacts and the switch only where there is a Contacts tab to
    // switch to; without them it drops its primary contact card.
    const bodyProps = {
        general: showsContacts ? { contacts, onShowContacts: showContacts } : {},
        contacts: { initialRows: contacts, onRows, onCount },
        tickets: { onCount },
        assets: { onCount },
    }[active] || {};

    const site = client?.primary_site;
    const open = Number(client?.open_tickets) || 0;

    const meta = [
        site?.sitename,
        site?.address?.suburbcity,
        // Same wording as the clients list (utils/clients.js clientMeta), so
        // the row you tapped and the page you land on agree.
        open > 0 ? `${open} open ${open === 1 ? 'ticket' : 'tickets'}` : null,
    ].filter(Boolean).join(' · ');

    // A button with nothing behind it is dropped rather than dimmed: there is
    // no row height to keep here, and three is already the maximum.
    const actions = [
        { key: 'call', icon: 'call-outline', label: 'Call', uri: dialUri(client?.phone) },
        { key: 'email', icon: 'mail-outline', label: 'Email', uri: mailUri(client?.email) },
        {
            key: 'directions',
            icon: 'navigate-outline',
            label: 'Directions',
            uri: mapsUri(addressLine(site?.address)),
        },
    ].filter((action) => action.uri);

    return (
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <StatusBar style={mode === 'light' ? 'dark' : 'light'} />

            <DetailHeader
                title={client?.name || 'Client'}
                subtitle={client?.status === 'inactive' ? 'Inactive' : null}
                fallback="/(main)/clients"
            />

            {loading || error || denied ? (
                <ScreenState
                    loading={loading}
                    error={error}
                    empty={!loading && !error && denied}
                    emptyText="You do not have access to this client"
                    emptyIcon="lock-closed-outline"
                    onRetry={load}
                />
            ) : (
                <>
                    <View style={[styles.identity, { borderBottomColor: colors.border }]}>
                        <View style={styles.head}>
                            <Avatar uri={client?.logo} name={client?.name} id={client?.id} size={46} />

                            <View style={styles.identityCopy}>
                                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>
                                    {client?.name}
                                </Text>
                                {meta ? (
                                    <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {meta}
                                    </Text>
                                ) : null}
                            </View>
                        </View>

                        {actions.length ? (
                            <View style={styles.actions}>
                                {actions.map((action) => (
                                    <TouchableOpacity
                                        key={action.key}
                                        onPress={() => Linking.openURL(action.uri)}
                                        style={[styles.action, { borderColor: colors.border }]}
                                        accessibilityRole="button"
                                        accessibilityLabel={action.label}
                                    >
                                        <Ionicons name={action.icon} size={15} color={colors.primary} />
                                        <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
                                            {action.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null}
                    </View>

                    <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.tabBarContent}
                        >
                            {tabs.map((tab) => {
                                const on = tab.id === active;
                                const tone = on ? colors.primary : colors.textSecondary;
                                const count = counts[tab.id];

                                return (
                                    <TouchableOpacity
                                        key={tab.id}
                                        onPress={() => setActive(tab.id)}
                                        style={[
                                            styles.tabBtn,
                                            { borderBottomColor: on ? colors.primary : 'transparent' },
                                        ]}
                                    >
                                        <Ionicons name={tab.icon} size={16} color={tone} />
                                        <Text
                                            style={[
                                                styles.tabLabel,
                                                { color: tone },
                                                on && { fontWeight: '700' },
                                            ]}
                                        >
                                            {tab.label}
                                        </Text>
                                        {typeof count === 'number' ? (
                                            <Text style={[styles.tabCount, { color: tone }]}>{count}</Text>
                                        ) : null}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <View style={styles.body}>
                        {Body ? <Body clientId={id} client={client} {...bodyProps} /> : null}
                    </View>
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    identity: {
        gap: 12,
        paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12,
        borderBottomWidth: 1,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    identityCopy: { flex: 1, gap: 2 },
    name: { fontSize: 17, fontWeight: '700' },
    meta: { fontSize: 12 },
    actions: { flexDirection: 'row', gap: 8 },
    action: {
        flex: 1, borderWidth: 1, borderRadius: 10,
        paddingVertical: 9,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    },
    actionLabel: { fontSize: 13, fontWeight: '600' },
    tabBar: { borderBottomWidth: 1 },
    tabBarContent: { paddingHorizontal: 8 },
    tabBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, height: 48,
        borderBottomWidth: 2,
    },
    tabLabel: { fontSize: 13, fontWeight: '600' },
    tabCount: { fontSize: 11, fontWeight: '700' },
    body: { flex: 1 },
});
