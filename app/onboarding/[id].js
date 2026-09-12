import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Theme from '../context/ThemeContext';
import api from '../services/api';
import DetailHeader from '../components/DetailHeader';
import ScreenState from '../components/ScreenState';
import Card, { cardGap, CardHeader, cardBodyPadding } from '../components/Card';
import LabelValue from '../components/LabelValue';
import RevealField from '../components/RevealField';
import IconButton from '../components/IconButton';
import Toast, { useToast } from '../components/Toast';
import { weekdayDateTime } from '../utils/datetime';

// There is no single-record onboarding endpoint — GET /api/assets/onboarding
// returns the whole set, so the record is picked out of it by id. The list is
// one row per machine, not the full history, so it stays small.
export default function OnboardingRecord() {
    const { id } = useLocalSearchParams();
    const { useTheme } = Theme;
    const { theme, mode } = useTheme();
    const { colors } = theme;

    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [missing, setMissing] = useState(false);
    const [toast, showToast] = useToast();

    const load = useCallback(async ({ refresh = false } = {}) => {
        if (refresh) setRefreshing(true); else setLoading(true);
        setError(null);
        setMissing(false);

        try {
            const response = await api.assetOnboarding();
            const list = Array.isArray(response?.assets) ? response.assets : [];
            const found = list.find((a) => String(a.id) === String(id));

            if (!found) setMissing(true);
            else setRecord(found);
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const copyUsername = useCallback(async () => {
        await Clipboard.setStringAsync(record?.username || 'localadmin');
        showToast('Username copied');
    }, [record, showToast]);

    return (
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <StatusBar style={mode === 'light' ? 'dark' : 'light'} />

            <DetailHeader
                title={record?.computername || 'Deployment'}
                subtitle={record?.client_name}
                fallback="/(main)/onboarding"
            />

            {loading || error || missing ? (
                <ScreenState
                    loading={loading}
                    error={error}
                    empty={!loading && !error && missing}
                    emptyText="That deployment record is no longer listed"
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
                        <CardHeader title="Machine" />
                        <View style={styles.machineBody}>
                            <LabelValue label="Client" value={record?.client_name} />
                            <LabelValue label="Computer" value={record?.computername} />
                            <LabelValue label="Was" value={record?.prev_computername} />
                            <LabelValue label="Deployed" value={weekdayDateTime(record?.created_at)} last />
                        </View>
                    </Card>

                    <Card>
                        {/* The asset label is the point of this header, not a
                            footnote, so it carries the brand blue — the same
                            token in both themes. */}
                        <CardHeader
                            title="Local administrator"
                            meta={record?.label_code || undefined}
                            metaTone={colors.primary}
                        />
                        <View style={styles.adminBody}>
                            <View style={styles.usernameBlock}>
                                <Text style={[styles.blockLabel, { color: colors.textSecondary }]}>
                                    Username
                                </Text>
                                <View style={styles.usernameRow}>
                                    <Text style={[styles.usernameValue, { color: colors.textPrimary }]}>
                                        {record?.username || 'localadmin'}
                                    </Text>
                                    <IconButton
                                        icon="copy-outline"
                                        size={16}
                                        label="Copy username"
                                        onPress={copyUsername}
                                    />
                                </View>
                            </View>

                            <RevealField label="Password" value={record?.localadmin_pw ?? '—'} large />
                        </View>
                    </Card>
                </ScrollView>
            )}

            <Toast message={toast} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    scroll: { padding: 16, gap: cardGap },
    machineBody: { ...cardBodyPadding },
    adminBody: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
    usernameBlock: { gap: 6 },
    blockLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    usernameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    usernameValue: {
        flex: 1, fontSize: 18, fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
});
