// GlassModal Component
// Modal overlay with enhanced frosted glass background

import React from 'react';
import { View, StyleSheet, Pressable, Dimensions, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
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

            {/* Modal content - scrollable */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoid}
            >
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
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={[styles.content, { backgroundColor: colors.backgroundSecondary + 'E6' }]}>
                            {children}
                        </View>
                    </ScrollView>
                </Animated.View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 100,
    },
    keyboardAvoid: {
        width: '100%',
        maxWidth: 500,
        maxHeight: SCREEN_HEIGHT * 0.8,
    },
    backdropTint: {
        ...StyleSheet.absoluteFillObject,
    },
    contentContainer: {
        borderRadius: glassMorphism.borderRadiusLarge,
        borderWidth: 1,
        overflow: 'hidden',
        maxHeight: SCREEN_HEIGHT * 0.8,
        width: '100%',
    },
    contentBackground: {
        ...StyleSheet.absoluteFillObject,
    },
    scrollView: {
        maxHeight: SCREEN_HEIGHT * 0.75,
    },
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        padding: 24,
        borderRadius: glassMorphism.borderRadiusLarge,
    },
});

