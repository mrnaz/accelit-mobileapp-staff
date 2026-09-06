import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Theme from '../context/ThemeContext';

// The app's one inline action: a 38pt bordered circle with a primary icon.
// Disabled buttons dim rather than disappear so row heights stay constant.
export default function IconButton({ icon, onPress, label, disabled = false, size = 17, style }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={[styles.button, { borderColor: colors.border, opacity: disabled ? 0.3 : 1 }, style]}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Ionicons name={icon} size={size} color={colors.primary} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        width: 38, height: 38, borderRadius: 19, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
});
