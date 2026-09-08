import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Theme from '../context/ThemeContext';
import useGoBack from '../utils/nav';

// Detail screens live outside (main) and draw their own header.
//
// Centred by default, with the back button's minWidth mirrored on the right
// so the title is not pulled off-centre. `align="left"` instead runs the
// title from the back button to the edge, with room for a `leading` node
// (the client's avatar) before it and a `trailing` one (the ticket's
// priority chip) beside it. The trailing node shares only the title's line:
// the subtitle runs the full width underneath, so a long "Created at" is not
// squeezed by the chip. Left-aligned text may wrap to a second line.
//
// `onTitlePress` makes the title itself a button — the ticket page opens the
// client from it — and adds a small chevron after the text as the cue.
// `titlePressLabel` names it for a screen reader.
export default function DetailHeader({
    title, subtitle, fallback = '/(main)', leading, trailing, align = 'center',
    onTitlePress, titlePressLabel,
}) {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;
    const goBack = useGoBack(fallback);
    const left = align === 'left';

    const titleLabel = (
        <Text
            style={[styles.title, (left || onTitlePress) && styles.titleShrink, { color: colors.textPrimary }]}
            numberOfLines={left ? 2 : 1}
        >
            {title}
        </Text>
    );

    const titleText = onTitlePress ? (
        <TouchableOpacity
            onPress={onTitlePress}
            style={[styles.titleButton, left && styles.titleLeft]}
            accessibilityRole="button"
            accessibilityLabel={titlePressLabel || title}
        >
            {titleLabel}
            <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </TouchableOpacity>
    ) : titleLabel;

    const subtitleText = subtitle ? (
        <Text
            style={[styles.subtitle, { color: colors.textSecondary }]}
            numberOfLines={left ? 2 : 1}
        >
            {subtitle}
        </Text>
    ) : null;

    return (
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={goBack} style={styles.iconBtn} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            {leading ? <View style={styles.leading}>{leading}</View> : null}

            {left ? (
                <View style={styles.titleWrapLeft}>
                    <View style={styles.titleRow}>
                        {titleText}
                        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
                    </View>
                    {subtitleText}
                </View>
            ) : (
                <>
                    <View style={styles.titleWrap}>
                        {titleText}
                        {subtitleText}
                    </View>
                    {trailing ? <View style={styles.trailing}>{trailing}</View> : <View style={styles.iconBtn} />}
                </>
            )}
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
    leading: { marginRight: 10 },
    titleWrap: { flex: 1, alignItems: 'center' },
    titleWrapLeft: { flex: 1, paddingRight: 8 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    trailing: {},
    title: { fontSize: 16, fontWeight: '700' },
    titleShrink: { flexShrink: 1 },
    titleLeft: { flex: 1 },
    titleButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    subtitle: { fontSize: 11, marginTop: 1 },
});
