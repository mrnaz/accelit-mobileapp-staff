import React, { useCallback, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Tabs, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import Theme from '../context/ThemeContext';
import { StaffProvider, useStaff } from '../context/StaffContext';
import StaffInfo from '../components/StaffInfo';

// Title + icon per route. The glyph matches the one in the Jump-to grid, so the
// icon at the top of a page is the one you tapped to get there.
const PAGE_TITLES = {
    index: { label: 'Dashboard', icon: 'home' },
    clients: { label: 'Clients', icon: 'building-o' },
    tickets: { label: 'Tickets', icon: 'ticket' },
    onboarding: { label: 'Asset Onboarding', icon: 'laptop' },
    'address-book': { label: 'Address Book', icon: 'address-book-o' },
};

function PageTitle() {
    const { useTheme } = Theme;
    const { theme } = useTheme();
    const { colors } = theme;
    const segments = useSegments();
    const { staff } = useStaff();

    const last = segments[segments.length - 1] || '';
    const route = PAGE_TITLES[last] ? last : 'index';
    const { label, icon } = PAGE_TITLES[route];

    let title = label;

    if (route === 'index') {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

        title = `${greeting}, ${staff?.fname || 'there'}`;
    }

    return (
        <View style={[styles.titleRow, { backgroundColor: colors.background }]}>
            <FontAwesome name={icon} size={18} color={colors.primary} />
            <Text
                style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', flex: 1 }}
                numberOfLines={1}
            >
                {title}
            </Text>
        </View>
    );
}

function Header() {
    const { useTheme } = Theme;
    const { theme, mode } = useTheme();
    const { colors } = theme;

    return (
        <>
            <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
            {/* The status-bar strip belongs to the header band below it, so it
                takes the surface colour rather than the page background. */}
            <SafeAreaView style={{ backgroundColor: colors.surface }} edges={['top']}>
                <StaffInfo />
                <PageTitle />
            </SafeAreaView>
        </>
    );
}

function ThemeBackground({ children }) {
    const { useTheme } = Theme;
    const { theme } = useTheme();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
            {children}
        </SafeAreaView>
    );
}

export default function MainLayout() {
    // A Tabs navigator used as a flat, always-mounted container: the tab bar is
    // rendered as null and navigation happens through the Jump-to grid instead.
    const renderTabBar = useCallback(() => null, []);
    const renderHeader = useCallback(() => <Header />, []);
    const screenOptions = useMemo(
        () => ({ header: renderHeader, headerShown: true }),
        [renderHeader],
    );

    return (
        <StaffProvider>
            <ThemeBackground>
                <Tabs tabBar={renderTabBar} screenOptions={screenOptions}>
                    <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
                    <Tabs.Screen name="clients" options={{ title: 'Clients' }} />
                    <Tabs.Screen name="tickets" options={{ title: 'Tickets' }} />
                    <Tabs.Screen name="onboarding" options={{ title: 'Asset Onboarding' }} />
                    <Tabs.Screen name="address-book" options={{ title: 'Address Book' }} />
                </Tabs>
            </ThemeBackground>
        </StaffProvider>
    );
}

const styles = {
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 8,
    },
};
