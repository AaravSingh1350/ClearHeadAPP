// Thoughts store for thinking engine
import { create } from 'zustand';
import { Thought } from '@/database/schema';
import { getDatabase, generateId, now } from '@/database';

interface ThoughtsState {
    thoughts: Thought[];
    isLoading: boolean;

    // Actions
    loadThoughts: (mode?: Thought['mode']) => Promise<void>;
    addThought: (mode: Thought['mode'], question: string, answer: string) => Promise<Thought>;
    updateThought: (id: string, answer: string) => Promise<void>;
    deleteThought: (id: string) => Promise<void>;
    getThoughtsByMode: (mode: Thought['mode']) => Thought[];
}

export const useThoughtsStore = create<ThoughtsState>((set, get) => ({
    thoughts: [],
    isLoading: false,

    loadThoughts: async (mode) => {
        set({ isLoading: true });
        try {
            const db = getDatabase();
            let query = 'SELECT * FROM thoughts ORDER BY created_at DESC';
            let params: any[] = [];

            if (mode) {
                query = 'SELECT * FROM thoughts WHERE mode = ? ORDER BY created_at DESC';
                params = [mode];
            }

            const result = await db.getAllAsync<Thought>(query, params);
            set({ thoughts: result, isLoading: false });
        } catch (error) {
            console.error('Failed to load thoughts:', error);
            set({ isLoading: false });
        }
    },

    addThought: async (mode, question, answer) => {
        const db = getDatabase();
        const id = generateId();
        const timestamp = now();

        const thought: Thought = {
            id,
            mode,
            question,
            answer,
            created_at: timestamp,
            updated_at: timestamp,
        };

        await db.runAsync(
            `INSERT INTO thoughts (id, mode, question, answer, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id, mode, question, answer, timestamp, timestamp]
        );

        // Add timeline entry
        const timelineId = generateId();
        await db.runAsync(
            `INSERT INTO timeline_entries (id, entry_type, reference_id, title, description, created_at, was_avoided)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [timelineId, 'thought', id, `${mode} thought`, answer.substring(0, 150), timestamp, 0]
        );

        set((state) => ({ thoughts: [thought, ...state.thoughts] }));
        return thought;
    },

    updateThought: async (id, answer) => {
        const db = getDatabase();
        const timestamp = now();

        await db.runAsync(
            'UPDATE thoughts SET answer = ?, updated_at = ? WHERE id = ?',
            [answer, timestamp, id]
        );

        set((state) => ({
            thoughts: state.thoughts.map((t) =>
                t.id === id ? { ...t, answer, updated_at: timestamp } : t
            ),
        }));
    },

    deleteThought: async (id) => {
        const db = getDatabase();
        await db.runAsync('DELETE FROM thoughts WHERE id = ?', [id]);
        set((state) => ({ thoughts: state.thoughts.filter((t) => t.id !== id) }));
    },

    getThoughtsByMode: (mode) => {
        return get().thoughts.filter((t) => t.mode === mode);
    },
}));
