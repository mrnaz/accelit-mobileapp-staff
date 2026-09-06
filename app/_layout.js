import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ThemeProvider as NavigationThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import Theme from './context/ThemeContext';
import { StaffProvider } from './context/StaffContext';
import api from './services/api';

const { ThemeProvider } = Theme;

const STACK_OPTIONS = { headerShown: false };

const useProtectedRoute = () => {
    const segments = useSegments();
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    const inAuthGroup = segments[0] === '(auth)';

    useEffect(() => {
        const checkAuth = async () => {
            try {
                if (segments.length === 0) return;

                // Restore the token on every navigation rather than only on the
                // index route: booting straight into a detail screen via a deep
                // link would otherwise leave the client unauthenticated and 401
                // every request.
                const token = await api.restore();

                setAuthenticated(!!token);

                if (!token && !inAuthGroup) {
                    router.replace('/(auth)/login');
                }
                // Deliberately no redirect out of (auth) for an authenticated
                // user — the OTP screen lives there and is reached mid-login.
            } catch (error) {
                console.error('Auth check error', error);
            } finally {
                setIsChecking(false);
            }
        };

        checkAuth();
    }, [segments]);

    return { isChecking, authenticated, inAuthGroup };
};

const RootLayoutInner = React.memo(function RootLayoutInner() {
    const { isChecking, authenticated, inAuthGroup } = useProtectedRoute();
    const { useTheme } = Theme;
    const { theme, mode } = useTheme();

    // React Navigation paints every tab scene and stack card with its own
    // theme's background before the screen renders, and expo-router hands it
    // the light DefaultTheme unless told otherwise. That is why the dark app
    // theme still showed a light grey page behind the lists. Derive the
    // navigation theme from the app's own mode so navigators and screens agree.
    const navigationTheme = useMemo(() => {
        const base = mode === 'dark' ? DarkTheme : DefaultTheme;
        const { colors } = theme;

        return {
            ...base,
            colors: {
                ...base.colors,
                primary: colors.primary,
                background: colors.background,
                card: colors.surface,
                text: colors.textPrimary,
                border: colors.border,
            },
        };
    }, [mode, theme]);

    if (isChecking) return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;

    // The staff profile is app-wide state. The client/ticket/onboarding detail
    // stacks sit beside (main) under this root Stack, not inside it, so the
    // provider has to live here rather than in the tabs layout. It only
    // fetches once a real token has been restored and the user is out of the
    // auth flow: GET /api/me without a token 401s, and the api client answers
    // a 401 by wiping the session and bouncing to login.
    return (
        <NavigationThemeProvider value={navigationTheme}>
            <StaffProvider enabled={authenticated && !inAuthGroup}>
                <Stack screenOptions={STACK_OPTIONS} />
            </StaffProvider>
        </NavigationThemeProvider>
    );
});

export default function RootLayout() {
    return (
        <ThemeProvider>
            <RootLayoutInner />
        </ThemeProvider>
    );
}
