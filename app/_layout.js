import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import Theme from './context/ThemeContext';
import api from './services/api';

const { ThemeProvider } = Theme;

const STACK_OPTIONS = { headerShown: false };

const useProtectedRoute = () => {
    const segments = useSegments();
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                if (segments.length === 0) return;

                const inAuthGroup = segments[0] === '(auth)';
                // Restore the token on every navigation rather than only on the
                // index route: booting straight into a detail screen via a deep
                // link would otherwise leave the client unauthenticated and 401
                // every request.
                const token = await api.restore();

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

    return isChecking;
};

const RootLayoutInner = React.memo(function RootLayoutInner() {
    const isChecking = useProtectedRoute();

    if (isChecking) return <View style={{ flex: 1 }} />;

    return <Stack screenOptions={STACK_OPTIONS} />;
});

export default function RootLayout() {
    return (
        <ThemeProvider>
            <RootLayoutInner />
        </ThemeProvider>
    );
}
