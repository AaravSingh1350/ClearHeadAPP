// Root Layout
// App entry point with font loading and database initialization

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase } from '@/database';
import { useAppStore, useThemeStore } from '@/stores';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

// Font assets - using variable fonts
const fontAssets = {
    'SpaceGrotesk': require('../assets/fonts/SpaceGrotesk-VariableFont_wght.ttf'),
    'Inter': require('../assets/fonts/Inter-VariableFont_opsz,wght.ttf'),
    'Orbitron': require('../assets/fonts/Orbitron-VariableFont_wght.ttf'),
    'JetBrainsMono': require('../assets/fonts/JetBrainsMono-VariableFont_wght.ttf'),
};

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    const setDbReady = useAppStore((state) => state.setDbReady);
    const { colors, colorScheme } = useThemeStore();

    useEffect(() => {
        async function prepare() {
            try {
                // Load fonts
                await Font.loadAsync(fontAssets);

                // Initialize database
                await initDatabase();
                setDbReady(true);
            } catch (e) {
                console.warn('Error loading app resources:', e);
            } finally {
                setAppIsReady(true);
            }
        }

        prepare();
    }, []);

    const onLayoutRootView = useCallback(async () => {
        if (appIsReady) {
            await SplashScreen.hideAsync();
        }
    }, [appIsReady]);

    if (!appIsReady) {
        return null;
    }

    return (
        <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]} onLayout={onLayoutRootView}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    animation: 'fade',
                }}
            >
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
            </Stack>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
