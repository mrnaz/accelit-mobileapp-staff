import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import Theme from '../context/ThemeContext';
import { useStaff } from '../context/StaffContext';
import api from '../services/api';
import DetailHeader from '../components/DetailHeader';
import ScreenState from '../components/ScreenState';
import { visibleTabs } from '../utils/clientTabs';
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
    const [accessLevel, setAccessLevel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [denied, setDenied] = useState(false);
    const [active, setActive] = useState(null);

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

    const Body = active ? TAB_BODIES[active] : null;

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
                        {client?.logo ? (
                            <Image source={{ uri: client.logo }} style={styles.logo} resizeMode="contain" />
                        ) : (
                            <View style={[styles.logo, styles.logoFallback, { backgroundColor: colors.primary + '1A' }]}>
                                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>
                                    {(client?.name || '?')[0].toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <View style={styles.identityCopy}>
                            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>
                                {client?.name}
                            </Text>
                            <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                                {client?.primary_site?.sitename || client?.timezone || ''}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.tabBarContent}
                        >
                            {tabs.map((tab) => {
                                const on = tab.id === active;

                                return (
                                    <TouchableOpacity
                                        key={tab.id}
                                        onPress={() => setActive(tab.id)}
                                        style={[
                                            styles.tabBtn,
                                            { borderBottomColor: on ? colors.primary : 'transparent' },
                                        ]}
                                    >
                                        <Ionicons
                                            name={tab.icon}
                                            size={16}
                                            color={on ? colors.primary : colors.textSecondary}
                                        />
                                        <Text
                                            style={[
                                                styles.tabLabel,
                                                { color: on ? colors.primary : colors.textSecondary },
                                                on && { fontWeight: '700' },
                                            ]}
                                        >
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <View style={styles.body}>
                        {Body ? <Body clientId={id} client={client} /> : null}
                    </View>
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    identity: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1 },
    logo: { width: 46, height: 46, borderRadius: 10 },
    logoFallback: { alignItems: 'center', justifyContent: 'center' },
    identityCopy: { flex: 1, gap: 2 },
    name: { fontSize: 17, fontWeight: '700' },
    meta: { fontSize: 12 },
    tabBar: { borderBottomWidth: 1 },
    tabBarContent: { paddingHorizontal: 8 },
    tabBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, height: 48,
        borderBottomWidth: 2,
    },
    tabLabel: { fontSize: 13, fontWeight: '600' },
    body: { flex: 1 },
});
