// GlassInput Component
// Text input with glass styling

import React, { useState } from 'react';
import {
    TextInput,
    View,
    Text,
    StyleSheet,
    TextInputProps,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useThemeStore } from '@/stores';
import { glassMorphism, typography } from '@/styles/theme';

interface GlassInputProps extends Omit<TextInputProps, 'style'> {
    label?: string;
    error?: string;
    helper?: string;
    containerStyle?: object;
}

export function GlassInput({
    label,
    error,
    helper,
    containerStyle,
    ...textInputProps
}: GlassInputProps) {
    const { colors, colorScheme } = useThemeStore();
    const [isFocused, setIsFocused] = useState(false);
    const focusAnim = useSharedValue(0);

    const handleFocus = () => {
        setIsFocused(true);
        focusAnim.value = withTiming(1, { duration: 200 });
    };

    const handleBlur = () => {
        setIsFocused(false);
        focusAnim.value = withTiming(0, { duration: 200 });
    };

    const containerAnimStyle = useAnimatedStyle(() => ({
        borderColor:
            focusAnim.value === 1
                ? colors.accentPositive
                : error
                    ? '#EF4444'
                    : colors.glassBorder,
    }));

    const bgOpacity = colorScheme === 'dark' ? 0.06 : 0.6;

    return (
        <View style={[styles.wrapper, containerStyle]}>
            {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
            <Animated.View style={[styles.container, containerAnimStyle]}>
                <BlurView
                    intensity={15}
                    tint={colorScheme}
                    style={StyleSheet.absoluteFill}
                />
                <View style={[styles.inputBackground, { backgroundColor: `rgba(255,255,255,${bgOpacity})` }]} />
                <TextInput
                    {...textInputProps}
                    style={[styles.input, { color: colors.textPrimary }]}
                    placeholderTextColor={colors.textSecondary}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
            </Animated.View>
            {(error || helper) && (
                <Text style={[styles.helper, { color: colors.textSecondary }, error && styles.errorText]}>
                    {error || helper}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
    },
    label: {
        fontSize: typography.bodySmall.fontSize,
        marginBottom: 8,
    },
    container: {
        borderRadius: glassMorphism.borderRadius,
        borderWidth: 1,
        overflow: 'hidden',
    },
    inputBackground: {
        ...StyleSheet.absoluteFillObject,
    },
    input: {
        fontSize: typography.body.fontSize,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    helper: {
        fontSize: typography.caption.fontSize,
        marginTop: 6,
    },
    errorText: {
        color: '#EF4444',
    },
});
