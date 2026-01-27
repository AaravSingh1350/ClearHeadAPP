// Font configuration for ClearHead
// Maps font names to their file paths for expo-font

export const fontAssets = {
    // Variable fonts - single file with all weights
    'SpaceGrotesk': require('../../assets/fonts/SpaceGrotesk-VariableFont_wght.ttf'),
    'Inter': require('../../assets/fonts/Inter-VariableFont_opsz,wght.ttf'),
    'Orbitron': require('../../assets/fonts/Orbitron-VariableFont_wght.ttf'),
    'JetBrainsMono': require('../../assets/fonts/JetBrainsMono-VariableFont_wght.ttf'),
} as const;

// Font family mapping for different contexts
export const fontFamilies = {
    thinking: {
        regular: 'SpaceGrotesk',
    },
    learning: {
        regular: 'Inter',
    },
    planner: {
        regular: 'Inter', // Using Inter as fallback for Satoshi
    },
    brutal: {
        regular: 'Orbitron',
    },
    mono: {
        regular: 'JetBrainsMono',
    },
} as const;
