import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import Theme from '../context/ThemeContext';
import api from '../services/api';
import DetailHeader from '../components/DetailHeader';
import ScreenState from '../components/ScreenState';
import Card, { cardGap, CardHeader, cardBodyPadding } from '../components/Card';
import LabelValue from '../components/LabelValue';
import RevealField from '../components/RevealField';
import { shortDate } from '../utils/datetime';

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
                        <View style={styles.inner}>
                            <LabelValue label="Client" value={record?.client_name} />
                            <LabelValue label="Computer" value={record?.computername} />
                            <LabelValue label="Was" value={record?.prev_computername} />
                            <LabelValue label="Label" value={record?.label_code} />
                            <LabelValue label="Deployed" value={shortDate(record?.created_at)} last />
                        </View>
                    </Card>

                    <Card>
                        <CardHeader title="Local administrator" />
                        <View style={styles.inner}>
                            <LabelValue label="Username" value={record?.username || 'localadmin'} last />

                            <View style={styles.password}>
                                <RevealField label="Password" value={record?.localadmin_pw ?? '—'} large />
                            </View>
                        </View>
                    </Card>

                    <Text style={[styles.footnote, { color: colors.textSecondary }]}>
                        Replaces the printed label. Read only.
                    </Text>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    scroll: { padding: 16, gap: cardGap },
    inner: { ...cardBodyPadding },
    password: { marginTop: 14 },
    footnote: { fontSize: 11, textAlign: 'center', marginTop: 2 },
});
