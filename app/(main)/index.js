import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Theme from '../context/ThemeContext';
import { useStaff } from '../context/StaffContext';
import { visibleMenu } from '../utils/menu';
import Card, { cardGap } from '../components/Card';

// A launcher, matching the reference app's dashboard. It makes no request of
// its own, so it paints instantly and cannot fail — which matters on a phone
// that has just come up on the VPN.
export default function Home() {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;
    const { staff } = useStaff();

    const menu = useMemo(() => visibleMenu(staff), [staff]);

    return (
        <ScrollView contentContainerStyle={styles.scroll}>
            {menu.map((item) => (
                <Card key={item.key} onPress={() => router.push(item.href)} style={styles.card}>
                    <View style={styles.row}>
                        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '1A' }]}>
                            <FontAwesome name={item.icon} size={20} color={colors.primary} />
                        </View>
                        <View style={styles.copy}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>{item.label}</Text>
                            <Text style={[styles.hint, { color: colors.textSecondary }]} numberOfLines={2}>
                                {item.hint}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                    </View>
                </Card>
            ))}

            <Text style={[styles.footnote, { color: colors.textSecondary }]}>
                Read only. Changes are made in Accel Online.
            </Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { padding: 16, gap: cardGap },
    card: { padding: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    iconWrap: {
        width: 46, height: 46, borderRadius: 23,
        alignItems: 'center', justifyContent: 'center',
    },
    copy: { flex: 1, gap: 3 },
    label: { fontSize: 15, fontWeight: '700' },
    hint: { fontSize: 12, lineHeight: 16 },
    footnote: { fontSize: 11, textAlign: 'center', marginTop: 6 },
});
