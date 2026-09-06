import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Theme from '../context/ThemeContext';

export default function Pills({ options, value, onChange }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    return (
        <View style={styles.row}>
            {options.map((option) => {
                const active = option.value === value;

                return (
                    <TouchableOpacity
                        key={option.value}
                        onPress={() => onChange(option.value)}
                        style={[
                            styles.pill,
                            { borderColor: active ? colors.primary : colors.border },
                            active && { backgroundColor: colors.primary + '1A' },
                        ]}
                        accessibilityRole="button"
                    >
                        <Text
                            style={[
                                styles.label,
                                { color: active ? colors.primary : colors.textSecondary },
                                active && { fontWeight: '700' },
                            ]}
                        >
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: 8 },
    pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
    label: { fontSize: 13, fontWeight: '600' },
});
