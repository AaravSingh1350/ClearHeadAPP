// ClearHead Theme Configuration
// Color palette and design tokens for liquid glass UI
// Supports both light and dark modes

export type ColorScheme = 'light' | 'dark';

// Dark mode colors (default)
const darkColors = {
    background: '#0A0A0A',
    backgroundSecondary: '#141414',
    glassSurface: 'rgba(255,255,255,0.08)',
    glassSurfaceHover: 'rgba(255,255,255,0.12)',
    glassBorder: 'rgba(255,255,255,0.1)',
    textPrimary: '#F5F5F5',
    textSecondary: '#9CA3AF',
    accentPositive: '#4ADE80',
    accentWarning: '#A3A3A3',

    // Memory decay states
    fresh: '#4ADE80',
    unstable: '#FBBF24',
    decaying: '#FB923C',
    neglected: '#6B7280',

    // Mode colors
    logical: '#60A5FA',
    brutal: '#EF4444',
    reflective: '#A78BFA',
    action: '#F59E0B',

    // Modal backdrop
    modalBackdrop: 'rgba(0,0,0,0.7)',
} as const;

// Light mode colors
const lightColors = {
    background: '#F8FAFC',
    backgroundSecondary: '#FFFFFF',
    glassSurface: 'rgba(0,0,0,0.04)',
    glassSurfaceHover: 'rgba(0,0,0,0.08)',
    glassBorder: 'rgba(0,0,0,0.1)',
    textPrimary: '#1F2937',
    textSecondary: '#6B7280',
    accentPositive: '#22C55E',
    accentWarning: '#71717A',

    // Memory decay states
    fresh: '#22C55E',
    unstable: '#F59E0B',
    decaying: '#EA580C',
    neglected: '#9CA3AF',

    // Mode colors
    logical: '#3B82F6',
    brutal: '#DC2626',
    reflective: '#8B5CF6',
    action: '#D97706',

    // Modal backdrop
    modalBackdrop: 'rgba(0,0,0,0.5)',
} as const;

export const themes = {
    dark: darkColors,
    light: lightColors,
} as const;

// Default to dark mode
export const colors = darkColors;

export const fonts = {
    thinking: 'SpaceGrotesk',
    learning: 'Inter',
    planner: 'Inter',
    brutal: 'Orbitron',
    mono: 'JetBrainsMono',
} as const;

export const glassMorphism = {
    blur: 20,
    blurHeavy: 40,
    blurModal: 60,
    transparency: 0.08,
    borderRadius: 16,
    borderRadiusLarge: 24,
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
} as const;

export const typography = {
    h1: {
        fontSize: 32,
        fontWeight: '700' as const,
        lineHeight: 40,
    },
    h2: {
        fontSize: 24,
        fontWeight: '600' as const,
        lineHeight: 32,
    },
    h3: {
        fontSize: 20,
        fontWeight: '600' as const,
        lineHeight: 28,
    },
    body: {
        fontSize: 16,
        fontWeight: '400' as const,
        lineHeight: 24,
    },
    bodySmall: {
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 20,
    },
    caption: {
        fontSize: 12,
        fontWeight: '400' as const,
        lineHeight: 16,
    },
    mono: {
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 20,
    },
} as const;

export type ThemeColors = typeof darkColors;
export type ThemeFonts = typeof fonts;
