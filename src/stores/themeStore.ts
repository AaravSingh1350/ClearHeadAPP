// Theme store for managing color scheme
import { create } from 'zustand';
import { ColorScheme, themes, ThemeColors } from '@/styles/theme';

interface ThemeState {
    colorScheme: ColorScheme;
    colors: ThemeColors;
    toggleColorScheme: () => void;
    setColorScheme: (scheme: ColorScheme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
    colorScheme: 'dark',
    colors: themes.dark,

    toggleColorScheme: () => set((state) => {
        const newScheme = state.colorScheme === 'dark' ? 'light' : 'dark';
        return {
            colorScheme: newScheme,
            colors: themes[newScheme],
        };
    }),

    setColorScheme: (scheme) => set({
        colorScheme: scheme,
        colors: themes[scheme],
    }),
}));
