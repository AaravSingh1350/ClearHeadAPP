// IntegrityBar Component
// Visual indicator for memory decay with animated gradient

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
} from 'react-native-reanimated';
import { useThemeStore } from '@/stores';
import { typography } from '@/styles/theme';
import { DecayState, getDecayColor } from '@/engines/learning/spacedRepetition';

interface IntegrityBarProps {
    percent: number;
    state: DecayState;
    showLabel?: boolean;
    height?: number;
}

export function IntegrityBar({
    percent,
    state,
    showLabel = true,
    height = 8,
}: IntegrityBarProps) {
    const { colors, colorScheme } = useThemeStore();
    const color = getDecayColor(state);

    const animatedWidth = useSharedValue(percent);

    React.useEffect(() => {
        animatedWidth.value = withSpring(percent, { damping: 20 });
    }, [percent]);

    const barStyle = useAnimatedStyle(() => ({
        width: `${animatedWidth.value}%`,
        backgroundColor: color,
    }));

    const stateLabel = {
        fresh: 'Fresh',
        unstable: 'Unstable',
        decaying: 'Decaying',
        neglected: 'Neglected',
    }[state];

    const trackBg = colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    return (
        <View style={styles.container}>
            {showLabel && (
                <View style={styles.labelRow}>
                    <Text style={[styles.stateLabel, { color }]}>{stateLabel}</Text>
                    <Text style={[styles.percentLabel, { color: colors.textSecondary }]}>{Math.round(percent)}%</Text>
                </View>
            )}
            <View style={[styles.track, { height, backgroundColor: trackBg }]}>
                <Animated.View style={[styles.bar, barStyle, { height }]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    stateLabel: {
        fontSize: typography.caption.fontSize,
        fontWeight: '500',
    },
    percentLabel: {
        fontSize: typography.caption.fontSize,
    },
    track: {
        borderRadius: 4,
        overflow: 'hidden',
    },
    bar: {
        borderRadius: 4,
    },
});
