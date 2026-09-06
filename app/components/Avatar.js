import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Theme from '../context/ThemeContext';
import { avatarColors } from '../utils/colors';
import { avatarText } from '../utils/initials';

// Ported from the Qobox staff app's Avatar. A remote image that falls back to
// initials when there is no URL or the load fails, tinted by the entity id so
// the same client always gets the same colour. The ring keeps a pale logo or
// a light tint from bleeding into the card behind it: neutral on an image,
// the avatar's own tint on initials.
//
// Client logos are wordmarks rather than portraits, so the image is
// `contain`ed on the surface colour instead of cropped to the circle.
export default function Avatar({ uri, name, id, size = 36, bordered = true, style }) {
    const { useTheme } = Theme;
    const { theme, mode } = useTheme();
    const { colors } = theme;
    const tint = avatarColors(id, name, mode);
    const [failed, setFailed] = useState(false);

    // A new URL deserves a fresh attempt.
    useEffect(() => { setFailed(false); }, [uri]);

    const radius = size / 2;
    const showImage = !!uri && !failed;
    const ring = bordered
        ? { borderWidth: 1, borderColor: showImage ? colors.border : tint.border }
        : null;

    if (showImage) {
        return (
            <Image
                source={{ uri }}
                onError={() => setFailed(true)}
                resizeMode="contain"
                style={[
                    { width: size, height: size, borderRadius: radius, backgroundColor: colors.surface },
                    ring,
                    style,
                ]}
            />
        );
    }

    return (
        <View
            style={[
                styles.placeholder,
                { width: size, height: size, borderRadius: radius, backgroundColor: tint.bg },
                ring,
                style,
            ]}
        >
            <Text style={[styles.text, { color: tint.text, fontSize: Math.max(10, size * 0.38) }]}>
                {avatarText(name) || '?'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    placeholder: { alignItems: 'center', justifyContent: 'center' },
    text: { fontWeight: '700' },
});
