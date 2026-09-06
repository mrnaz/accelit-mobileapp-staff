import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import Theme from '../context/ThemeContext';

// A label/value row. When `uri` is given the value becomes tappable and takes
// the primary colour, which is how phone numbers and emails read as actions.
export default function LabelValue({ label, value, uri, last }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    const shown = value || '—';
    const tappable = !!uri && !!value;

    const body = (
        <Text
            style={[styles.value, { color: tappable ? colors.primary : colors.textPrimary }]}
            numberOfLines={2}
        >
            {shown}
        </Text>
    );

    return (
        <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
            {tappable
                ? <TouchableOpacity onPress={() => Linking.openURL(uri)} style={styles.valueWrap}>{body}</TouchableOpacity>
                : <View style={styles.valueWrap}>{body}</View>}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11 },
    label: { fontSize: 12, fontWeight: '600', width: 92, paddingTop: 1 },
    valueWrap: { flex: 1 },
    value: { fontSize: 14, fontWeight: '500' },
});
