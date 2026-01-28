// Animation utilities for consistent screen animations
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Hook that returns a stable key for animations.
 * Animations will only play on initial mount, not on every focus.
 * This prevents jitter when switching between tabs.
 */
export function useAnimationKey() {
    // Return a stable key - animations play only on first mount
    // This prevents jitter when switching tabs
    return 'stable';
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
