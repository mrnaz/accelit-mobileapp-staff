import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import Theme from '../context/ThemeContext';
import IconButton from './IconButton';

// A label/value row. When `uri` is given the value becomes tappable and takes
// the primary colour, which is how phone numbers and emails read as actions.
//
// `icon` adds a round button at the end of the row that opens the same uri —
// the site card's call and directions buttons. It dims rather than disappears
// when there is nothing to open, so the row keeps its height. `iconLabel`
// names it for a screen reader ("Call", "Directions").
export default function LabelValue({ label, value, uri, icon, iconLabel, last }) {
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
        <View
            style={[
                styles.row,
                icon && styles.rowWithIcon,
                !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
        >
            <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
            {tappable
                ? <TouchableOpacity onPress={() => Linking.openURL(uri)} style={styles.valueWrap}>{body}</TouchableOpacity>
                : <View style={styles.valueWrap}>{body}</View>}
            {icon ? (
                <IconButton
                    icon={icon}
                    size={15}
                    label={iconLabel || label}
                    disabled={!tappable}
                    onPress={() => Linking.openURL(uri)}
                    style={styles.iconButton}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11 },
    rowWithIcon: { alignItems: 'center', paddingVertical: 6 },
    label: { fontSize: 12, fontWeight: '600', width: 92, paddingTop: 1 },
    valueWrap: { flex: 1 },
    value: { fontSize: 14, fontWeight: '500' },
    iconButton: { width: 32, height: 32, borderRadius: 16 },
});
