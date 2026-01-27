/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,jsx,ts,tsx}",
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                background: '#0A0A0A',
                'glass-surface': 'rgba(255,255,255,0.08)',
                'text-primary': '#F5F5F5',
                'text-secondary': '#9CA3AF',
                'accent-positive': '#4ADE80',
                'accent-warning': '#A3A3A3',
            },
            fontFamily: {
                'thinking': ['SpaceGrotesk'],
                'learning': ['Inter'],
                'planner': ['Satoshi'],
                'brutal': ['Orbitron'],
                'mono': ['JetBrainsMono'],
            },
            backdropBlur: {
                'glass': '20px',
                'glass-heavy': '40px',
            },
        },
    },
    plugins: [],
};
