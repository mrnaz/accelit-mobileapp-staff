import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Theme from '../context/ThemeContext';
import useGoBack from '../utils/nav';

// Detail screens live outside (main) and draw their own header. The back button
// keeps a fixed minWidth so the centred title is not pulled off-centre.
export default function DetailHeader({ title, subtitle, fallback = '/(main)' }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;
    const goBack = useGoBack(fallback);

    return (
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={goBack} style={styles.iconBtn} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.titleWrap}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {title}
                </Text>
                {subtitle ? (
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>

            <View style={styles.iconBtn} />
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 8, paddingVertical: 10,
        borderBottomWidth: 1,
    },
    iconBtn: { minWidth: 40, alignItems: 'center', justifyContent: 'center', padding: 8 },
    titleWrap: { flex: 1, alignItems: 'center' },
    title: { fontSize: 16, fontWeight: '700' },
    subtitle: { fontSize: 11, marginTop: 1 },
});
