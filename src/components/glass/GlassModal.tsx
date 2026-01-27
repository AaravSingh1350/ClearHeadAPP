// GlassModal Component
// Modal overlay with enhanced frosted glass background

import React from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown,
} from 'react-native-reanimated';
import { useThemeStore } from '@/stores';
import { glassMorphism } from '@/styles/theme';

interface GlassModalProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    dismissible?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function GlassModal({
    visible,
    onClose,
    children,
    dismissible = true,
}: GlassModalProps) {
    const { colors, colorScheme } = useThemeStore();

    if (!visible) return null;

    const handleBackdropPress = () => {
        if (dismissible) {
            onClose();
        }
    };

    return (
        <View style={styles.overlay}>
            {/* Enhanced blur backdrop */}
            <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                style={StyleSheet.absoluteFill}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress}>
                    <BlurView
                        intensity={glassMorphism.blurModal}
                        tint={colorScheme}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={[styles.backdropTint, { backgroundColor: colors.modalBackdrop }]} />
                </Pressable>
            </Animated.View>

            {/* Modal content - centered with bottom padding for tab bar */}
            <Animated.View
                entering={SlideInDown.springify().damping(18)}
                exiting={SlideOutDown.duration(200)}
                style={[styles.contentContainer, { borderColor: colors.glassBorder }]}
            >
                <BlurView
                    intensity={glassMorphism.blurHeavy}
                    tint={colorScheme}
                    style={StyleSheet.absoluteFill}
                />
                <View style={[styles.contentBackground, { backgroundColor: colors.glassSurface }]} />
                <View style={[styles.content, { backgroundColor: colors.backgroundSecondary + 'E6' }]}>
                    {children}
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center', // Center the modal vertically
        alignItems: 'center',
        zIndex: 1000,
        paddingHorizontal: 16,
        paddingBottom: 100, // Space for tab bar
    },
    backdropTint: {
        ...StyleSheet.absoluteFillObject,
    },
    contentContainer: {
        borderRadius: glassMorphism.borderRadiusLarge,
        borderWidth: 1,
        overflow: 'hidden',
        maxHeight: SCREEN_HEIGHT * 0.7,
        width: '100%',
        maxWidth: 500,
    },
    contentBackground: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        padding: 24,
        borderRadius: glassMorphism.borderRadiusLarge,
    },
});
