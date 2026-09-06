// Accel IT staff app palette.
//
// The brand tokens mirror the web admin's Vuexy theme so the app reads as the
// same product: primary #4b8fc8 with #3C82B4 for pressed states, and the same
// success/info/warning ramp. The named colour families below are generic
// semantic swatches carried over unchanged — utils/iconColors.js indexes them
// by name, so they are shared vocabulary rather than brand.

// ─── Light palette ──────────────────────────────────────────────────────────
export const lightColors = {
    primary: '#4b8fc8',
    primaryLight: '#6ba3d4',
    primaryDark: '#3C82B4',

    background: '#F4F5FA',
    backgroundLight: '#FFFFFF',
    backgroundDark: '#E7E8EE',

    surface: '#ffffff',

    textPrimary: '#2F2B3D',
    textSecondary: '#6D6B77',
    textDisabled: '#A5A3AE',

    success: '#28C76F',
    warning: '#FF9F43',
    error: '#EA5455',
    info: '#00BAD1',

    border: '#E4E4E8',
    borderStrong: '#CFCFD6',

    cardBackground: '#ffffff',
    cardShadow: '#2F2B3D',
    cardShadowOpacity: 0.08,
    cardShadowRadius: 0,
    cardElevation: 3,
    cardShadowOffset: { width: 0, height: 3 },
    cardBorderWidth: 1,
    cardBorderRadius: 16,

    inputBackground: '#F4F5FA',
    divider: '#E4E4E8',

    commentText: '#55525F',

    onPrimary: '#ffffff',

    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.2)',
    pressedOverlay: 'rgba(0, 0, 0, 0.05)',

    purple: {
        border: '#D7C0F9',
        background: '#EBDEF7',
        text: '#7a4fd6',
    },
    indigo: {
        border: '#C9C6F9',
        background: '#E1E1F7',
        text: '#5c50d6',
    },
    azure: {
        border: '#ACCBF9',
        background: '#D6E8F7',
        text: '#2060d6',
    },
    teal: {
        border: '#A4CECE',
        background: '#DBE9E9',
        text: '#006b6b',
    },
    cyan: {
        border: '#94E2DD',
        background: '#C5F4F4',
        text: '#009b8d',
    },
    turquoise: {
        border: '#94E6BE',
        background: '#C5F4E1',
        text: '#00a855',
    },
    lime: {
        border: '#97E697',
        background: '#CAF5CA',
        text: '#00a000',
    },
    emerald: {
        border: '#BFE18C',
        background: '#DFEDBB',
        text: '#5a9e00',
    },
    sunflower: {
        border: '#DAD68D',
        background: '#F4F4B6',
        text: '#a89700',
    },
    amber: {
        border: '#EED098',
        background: '#F8E8C5',
        text: '#b87800',
    },
    tangerine: {
        border: '#F9C69D',
        background: '#F7E2D1',
        text: '#d45e00',
    },
    ruby: {
        border: '#F9AEAE',
        background: '#F7DBDB',
        text: '#d01818',
    },
    rose: {
        border: '#F9A6D4',
        background: '#F7DDEA',
        text: '#cc0070',
    },
    magenta: {
        border: '#F9A4F9',
        background: '#F7DBF7',
        text: '#cc00cc',
    },
    steel: {
        border: '#CBCBCB',
        background: '#E7E7E7',
        text: '#666666',
    },
    choco: {
        border: '#CCB59F',
        background: '#E3D4C8',
        text: '#6b4420',
    },
};

// ─── Dark palette ───────────────────────────────────────────────────────────
export const darkColors = {
    primary: '#4b8fc8',
    primaryLight: '#6ba3d4',
    primaryDark: '#3C82B4',

    background: '#25293C',
    backgroundLight: '#2F3349',
    backgroundDark: '#1B1E2C',

    surface: '#2F3349',

    textPrimary: '#E1DEF5',
    textSecondary: '#B0AEC0',
    textDisabled: '#7A7887',

    success: '#28C76F',
    warning: '#FF9F43',
    error: '#EA5455',
    info: '#00BAD1',

    border: '#43485C',
    borderStrong: '#565B70',

    cardBackground: '#2F3349',
    cardShadow: '#000',
    cardShadowOpacity: 0,
    cardShadowRadius: 0,
    cardElevation: 0,
    cardShadowOffset: { width: 0, height: 0 },
    cardBorderWidth: 1,
    cardBorderRadius: 16,

    inputBackground: '#2A2E42',
    divider: '#3A3F55',

    commentText: '#A3A1B5',

    onPrimary: '#ffffff',

    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.2)',
    pressedOverlay: 'rgba(255, 255, 255, 0.06)',

    purple: {
        border: '#5B3E8F',
        background: '#473769',
        text: '#b070ff',
    },
    indigo: {
        border: '#47479F',
        background: '#31377E',
        text: '#8880ff',
    },
    azure: {
        border: '#2E5883',
        background: '#28465F',
        text: '#5aabff',
    },
    teal: {
        border: '#2B5F63',
        background: '#27454B',
        text: '#40c0c0',
    },
    cyan: {
        border: '#256262',
        background: '#2B4A51',
        text: '#20d0c0',
    },
    turquoise: {
        border: '#236A50',
        background: '#2A4D48',
        text: '#20d880',
    },
    lime: {
        border: '#256530',
        background: '#2B4A39',
        text: '#40d840',
    },
    emerald: {
        border: '#49642D',
        background: '#3C4A37',
        text: '#90d040',
    },
    sunflower: {
        border: '#5E6439',
        background: '#41483C',
        text: '#d0cc40',
    },
    amber: {
        border: '#6E5B2C',
        background: '#494637',
        text: '#e0a830',
    },
    tangerine: {
        border: '#774C29',
        background: '#534234',
        text: '#e07830',
    },
    ruby: {
        border: '#7B3438',
        background: '#532F34',
        text: '#f05050',
    },
    rose: {
        border: '#7B2B5E',
        background: '#552E4B',
        text: '#f040a8',
    },
    magenta: {
        border: '#7A2484',
        background: '#552E62',
        text: '#f040f0',
    },
    steel: {
        border: '#5D6267',
        background: '#434A50',
        text: '#c0c0c0',
    },
    choco: {
        border: '#665042',
        background: '#41332C',
        text: '#c09060',
    },
};

// tickets.priority is a CHAR(1) constrained to C/H/N/L. Labels and colours live
// only in the web frontend, so they are restated here rather than fetched.
export const priorityColors = {
    C: '#FE2323',
    H: '#FF7000',
    N: '#00C400',
    L: '#2C7AFE',
};

export const priorityLabels = {
    C: 'Critical',
    H: 'High',
    N: 'Normal',
    L: 'Low',
};

export const fontSizes = {
    xs: 12, sm: 14, base: 16, lg: 18, xl: 20,
    '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48,
};

export const spacing = {
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48, '3xl': 64,
};

export const borderRadius = {
    none: 0, sm: 6, md: 10, lg: 16, xl: 20, full: 9999,
};

export const shadows = {
    none: 'none',
};

export const colors = darkColors;

export const theme = {
    colors: darkColors, fontSizes, spacing, borderRadius, shadows,
};

export const themes = {
    light: { colors: lightColors, fontSizes, spacing, borderRadius, shadows },
    dark:  { colors: darkColors,  fontSizes, spacing, borderRadius, shadows },
};

export default theme;
