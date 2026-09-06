import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Theme from '../context/ThemeContext';

export default function SectionLabel({ children, style }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    return <Text style={[styles.label, { color: colors.textSecondary }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
    label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
