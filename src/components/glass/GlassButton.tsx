// GlassButton Component
// Interactive button with glass styling and motion effects

import React from 'react';
import { Text, StyleSheet, Pressable, ActivityIndicator, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    interpolateColor,
} from 'react-native-reanimated';
import { useThemeStore } from '@/stores';
import { glassMorphism } from '@/styles/theme';

interface GlassButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'default' | 'primary' | 'danger' | 'ghost';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    fullWidth?: boolean;
    style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GlassButton({
    title,
    onPress,
    variant = 'default',
    size = 'medium',
    disabled = false,
    loading = false,
    icon,
    fullWidth = false,
    style,
}: GlassButtonProps) {
    const { colors, colorScheme } = useThemeStore();
    const scale = useSharedValue(1);
    const pressed = useSharedValue(0);

    const sizeStyles = {
        small: { paddingVertical: 8, paddingHorizontal: 16, fontSize: 14 },
        medium: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 16 },
        large: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 18 },
    };

    const animatedStyle = useAnimatedStyle(() => {
        const bgColor = interpolateColor(
            pressed.value,
            [0, 1],
            [
                variant === 'ghost' ? 'transparent' : 'rgba(255,255,255,0.08)',
                'rgba(255,255,255,0.15)',
            ]
        );

        return {
            transform: [{ scale: scale.value }],
            backgroundColor: bgColor,
            opacity: disabled ? 0.5 : 1,
        };
    });

    const handlePressIn = () => {
        if (!disabled && !loading) {
            scale.value = withSpring(0.96, { damping: 15 });
            pressed.value = withTiming(1, { duration: 100 });
        }
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15 });
        pressed.value = withTiming(0, { duration: 200 });
    };

    const handlePress = () => {
        if (!disabled && !loading) {
            onPress();
        }
    };

    // Dynamic text colors based on variant and theme
    // Primary buttons: white text in dark mode, black text in light mode
    const textColor =
        variant === 'primary'
            ? colorScheme === 'dark' ? '#FFFFFF' : '#1A1A1A'
            : variant === 'danger'
                ? '#EF4444'
                : colors.textPrimary;

    return (
        <AnimatedPressable
            style={[
                styles.container,
                animatedStyle,
                {
                    paddingVertical: sizeStyles[size].paddingVertical,
                    paddingHorizontal: sizeStyles[size].paddingHorizontal,
                    borderColor: variant === 'ghost' ? 'transparent' : colors.glassBorder,
                    backgroundColor:
                        variant === 'primary'
                            ? colors.accentPositive
                            : variant === 'danger'
                                ? 'rgba(239,68,68,0.2)'
                                : undefined,
                },
                fullWidth && styles.fullWidth,
                style,
            ]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            disabled={disabled || loading}
        >
            {variant !== 'primary' && variant !== 'danger' && (
                <BlurView
                    intensity={10}
                    tint={colorScheme}
                    style={StyleSheet.absoluteFill}
                />
            )}
            {loading ? (
                <ActivityIndicator color={textColor} />
            ) : (
                <>
                    {icon}
                    <Text
                        style={[
                            styles.text,
                            {
                                fontSize: sizeStyles[size].fontSize,
                                color: textColor,
                                marginLeft: icon ? 8 : 0,
                            },
                        ]}
                    >
                        {title}
                    </Text>
                </>
            )}
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: glassMorphism.borderRadius,
        borderWidth: 1,
        overflow: 'hidden',
    },
    fullWidth: {
        width: '100%',
    },
    text: {
        fontWeight: '600',
    },
});
