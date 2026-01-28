// Tabs Layout
// Bottom tab navigation for 6 sections

import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@/stores';

type TabIconName =
    | 'bulb-outline' | 'bulb'
    | 'book-outline' | 'book'
    | 'calendar-outline' | 'calendar'
    | 'time-outline' | 'time'
    | 'analytics-outline' | 'analytics'
    | 'settings-outline' | 'settings';

interface TabConfig {
    name: string;
    title: string;
    iconOutline: TabIconName;
    iconFilled: TabIconName;
}

const tabs: TabConfig[] = [
    { name: 'thinking', title: 'Think', iconOutline: 'bulb-outline', iconFilled: 'bulb' },
    { name: 'learning', title: 'CogniFlow', iconOutline: 'book-outline', iconFilled: 'book' },
    { name: 'planner', title: 'Plan', iconOutline: 'calendar-outline', iconFilled: 'calendar' },
    { name: 'timeline', title: 'Timeline', iconOutline: 'time-outline', iconFilled: 'time' },
    { name: 'insights', title: 'Insights', iconOutline: 'analytics-outline', iconFilled: 'analytics' },
    { name: 'backup', title: 'Settings', iconOutline: 'settings-outline', iconFilled: 'settings' },
];

export default function TabsLayout() {
    const { colors, colorScheme } = useThemeStore();

    const TabBarBackground = () => (
        <View style={StyleSheet.absoluteFill}>
            <BlurView intensity={40} tint={colorScheme} style={StyleSheet.absoluteFill} />
            <View style={[
                styles.tabBarOverlay,
                { backgroundColor: colorScheme === 'dark' ? 'rgba(10, 10, 10, 0.8)' : 'rgba(248, 250, 252, 0.8)' }
            ]} />
        </View>
    );

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.accentPositive,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarStyle: [styles.tabBar, { borderTopColor: colors.glassBorder }],
                tabBarBackground: TabBarBackground,
                tabBarLabelStyle: styles.tabBarLabel,
            }}
        >
            {tabs.map((tab) => (
                <Tabs.Screen
                    key={tab.name}
                    name={tab.name}
                    options={{
                        title: tab.title,
                        tabBarIcon: ({ focused, color }) => (
                            <Ionicons
                                name={focused ? tab.iconFilled : tab.iconOutline}
                                size={22}
                                color={color}
                            />
                        ),
                    }}
                />
            ))}
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        borderTopWidth: 1,
        backgroundColor: 'transparent',
        height: 85,
        paddingTop: 8,
    },
    tabBarOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    tabBarLabel: {
        fontSize: 10,
        fontWeight: '500',
        marginTop: 2,
    },
});
