// GlassCard Component
// Base glass container with blur, transparency, and depth layers

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { useThemeStore } from '@/stores';
import { glassMorphism } from '@/styles/theme';

interface GlassCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    intensity?: 'light' | 'default' | 'heavy';
    depth?: 1 | 2 | 3;
    animated?: boolean;
    pressable?: boolean;
    onPress?: () => void;
}

export function GlassCard({
    children,
    style,
    intensity = 'default',
    depth = 1,
    animated = false,
    pressable = false,
    onPress,
}: GlassCardProps) {
    const { colors, colorScheme } = useThemeStore();
    const scale = useSharedValue(1);

    const blurIntensity = {
        light: 10,
        default: glassMorphism.blur,
        heavy: glassMorphism.blurHeavy,
    }[intensity];

    const bgOpacity = {
        1: colorScheme === 'dark' ? 0.06 : 0.4,
        2: colorScheme === 'dark' ? 0.08 : 0.6,
        3: colorScheme === 'dark' ? 0.12 : 0.8,
    }[depth];

    const bgColor = colorScheme === 'dark'
        ? `rgba(255,255,255,${bgOpacity})`
        : `rgba(255,255,255,${bgOpacity})`;

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        if (pressable) {
            scale.value = withSpring(0.98, { damping: 15 });
        }
    };

    const handlePressOut = () => {
        if (pressable) {
            scale.value = withSpring(1, { damping: 15 });
            onPress?.();
        }
    };

    const content = (
        <>
            <BlurView
                intensity={blurIntensity}
                tint={colorScheme}
                style={StyleSheet.absoluteFill}
            />
            <View
                style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: bgColor },
                ]}
            />
            <View style={styles.content}>{children}</View>
        </>
    );

    if (animated || pressable) {
        return (
            <Animated.View
                style={[
                    styles.container,
                    { borderColor: colors.glassBorder },
                    animatedStyle,
                    style
                ]}
                onTouchStart={handlePressIn}
                onTouchEnd={handlePressOut}
                onTouchCancel={handlePressOut}
            >
                {content}
            </Animated.View>
        );
    }

    return (
        <View style={[styles.container, { borderColor: colors.glassBorder }, style]}>
            {content}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: glassMorphism.borderRadius,
        borderWidth: 1,
        overflow: 'hidden',
    },
    content: {
        position: 'relative',
        zIndex: 1,
    },
});
