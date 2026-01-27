// Main Zustand store for ClearHead app state
import { create } from 'zustand';
import { Thought, StudyTopic, Task, TimeBlock, TimelineEntry } from '@/database/schema';

// App state interface
interface AppState {
    // Database initialization
    isDbReady: boolean;
    setDbReady: (ready: boolean) => void;

    // Current section
    activeSection: 'thinking' | 'learning' | 'planner' | 'timeline' | 'insights' | 'backup';
    setActiveSection: (section: AppState['activeSection']) => void;

    // Thinking engine state
    currentThinkingMode: 'logical' | 'brutal' | 'reflective' | 'action';
    setThinkingMode: (mode: AppState['currentThinkingMode']) => void;
    currentQuestionIndex: number;
    setQuestionIndex: (index: number) => void;

    // Daily study prompt
    showDailyPrompt: boolean;
    setShowDailyPrompt: (show: boolean) => void;
    lastPromptDate: string | null;
    setLastPromptDate: (date: string) => void;

    // Planner state
    selectedDate: string;
    setSelectedDate: (date: string) => void;

    // Loading states
    isLoading: boolean;
    setLoading: (loading: boolean) => void;

    // Error handling
    error: string | null;
    setError: (error: string | null) => void;
    clearError: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    // Database
    isDbReady: false,
    setDbReady: (ready) => set({ isDbReady: ready }),

    // Section
    activeSection: 'thinking',
    setActiveSection: (section) => set({ activeSection: section }),

    // Thinking
    currentThinkingMode: 'logical',
    setThinkingMode: (mode) => set({ currentThinkingMode: mode }),
    currentQuestionIndex: 0,
    setQuestionIndex: (index) => set({ currentQuestionIndex: index }),

    // Daily prompt
    showDailyPrompt: false,
    setShowDailyPrompt: (show) => set({ showDailyPrompt: show }),
    lastPromptDate: null,
    setLastPromptDate: (date) => set({ lastPromptDate: date }),

    // Planner
    selectedDate: new Date().toISOString().split('T')[0],
    setSelectedDate: (date) => set({ selectedDate: date }),

    // Loading
    isLoading: false,
    setLoading: (loading) => set({ isLoading: loading }),

    // Error
    error: null,
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
}));
