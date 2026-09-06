import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Theme from '../context/ThemeContext';

export default function ThemeToggle() {
    const { useTheme } = Theme;
    const { theme, mode, toggleMode } = useTheme();
    const { colors } = theme;
    const dark = mode !== 'light';

    return (
        <TouchableOpacity
            onPress={toggleMode}
            style={[styles.button, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
            <FontAwesome name={dark ? 'sun-o' : 'moon-o'} size={15} color={colors.textPrimary} />
            <Text style={[styles.label, { color: colors.textPrimary }]}>{dark ? 'Light' : 'Dark'}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row', alignItems: 'center', gap: 7,
        borderWidth: 1, borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 9,
    },
    label: { fontSize: 13, fontWeight: '600' },
});
