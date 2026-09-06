import { Platform } from 'react-native';

export function mapsQuery(query) {
    const text = typeof query === 'string' ? query.trim() : '';

    return text ? encodeURIComponent(text) : null;
}

// Apple Maps on iOS, the geo: intent on Android, so the platform's own maps
// app opens rather than a browser tab.
export function mapsUri(query) {
    const q = mapsQuery(query);

    if (!q) return null;

    return Platform.OS === 'ios' ? `https://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}`;
}
