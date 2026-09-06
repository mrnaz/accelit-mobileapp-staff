import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Theme from '../context/ThemeContext';

const DURATION = 1800;

export function useToast() {
    const [message, setMessage] = useState(null);
    const timer = useRef(null);

    const show = useCallback((text) => {
        clearTimeout(timer.current);
        setMessage(text);
        timer.current = setTimeout(() => setMessage(null), DURATION);
    }, []);

    useEffect(() => () => clearTimeout(timer.current), []);

    return [message, show];
}

// Bottom pill, inverted colours so it reads over any card. Render it last in
// the screen so it sits above the content.
export default function Toast({ message }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;

    if (!message) return null;

    return (
        <View pointerEvents="none" style={styles.wrap}>
            <View style={[styles.pill, { backgroundColor: colors.textPrimary }]}>
                <Text style={[styles.text, { color: colors.background }]}>{message}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, bottom: 48, alignItems: 'center' },
    pill: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
    text: { fontSize: 13, fontWeight: '600' },
});
