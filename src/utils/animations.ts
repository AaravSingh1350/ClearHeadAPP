// Animation utilities for consistent screen animations
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Hook that returns a key that changes every time the screen comes into focus.
 * Use this key on Animated.View to replay entering animations.
 */
export function useAnimationKey() {
    const [key, setKey] = useState(0);

    useFocusEffect(
        useCallback(() => {
            setKey(prev => prev + 1);
        }, [])
    );

    return key;
}

/**
 * Hook that returns whether this is the first render since focus.
 * Useful for conditional animation logic.
 */
export function useScreenFocus() {
    const [isFocused, setIsFocused] = useState(false);

    useFocusEffect(
        useCallback(() => {
            setIsFocused(true);
            return () => setIsFocused(false);
        }, [])
    );

    return isFocused;
}
