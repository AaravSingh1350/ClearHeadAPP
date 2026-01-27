// Learning store for study topics and spaced repetition
import { create } from 'zustand';
import { StudyTopic, Revision } from '@/database/schema';
import { getDatabase, generateId, now, formatDate } from '@/database';
import { calculateNextReview, calculateDecayState, REVIEW_INTERVALS } from '@/engines/learning/spacedRepetition';

interface LearningState {
    topics: StudyTopic[];
    revisions: Revision[];
    dueRevisions: Revision[];
    isLoading: boolean;

    // Actions
    loadTopics: () => Promise<void>;
    loadRevisions: (topicId?: string) => Promise<void>;
    loadDueRevisions: () => Promise<void>;

    addTopic: (topic: string, timeSpent: number, confidence: number) => Promise<StudyTopic>;
    updateTopic: (id: string, updates: Partial<StudyTopic>) => Promise<void>;
    deleteTopic: (id: string) => Promise<void>;

    completeRevision: (revisionId: string, confidenceAfter: number) => Promise<void>;
    markRevisionMissed: (revisionId: string) => Promise<void>;

    updateDecayStates: () => Promise<void>;
}

export const useLearningStore = create<LearningState>((set, get) => ({
    topics: [],
    revisions: [],
    dueRevisions: [],
    isLoading: false,

    loadTopics: async () => {
        set({ isLoading: true });
        try {
            const db = getDatabase();
            const result = await db.getAllAsync<StudyTopic>(
                'SELECT * FROM study_topics ORDER BY next_review_at ASC NULLS LAST'
            );
            set({ topics: result, isLoading: false });
        } catch (error) {
            console.error('Failed to load topics:', error);
            set({ isLoading: false });
        }
    },

    loadRevisions: async (topicId) => {
        const db = getDatabase();
        let query = 'SELECT * FROM revisions ORDER BY scheduled_at DESC';
        let params: any[] = [];

        if (topicId) {
            query = 'SELECT * FROM revisions WHERE topic_id = ? ORDER BY scheduled_at DESC';
            params = [topicId];
        }

        const result = await db.getAllAsync<Revision>(query, params);
        set({ revisions: result });
    },

    loadDueRevisions: async () => {
        const db = getDatabase();
        const today = now();

        const result = await db.getAllAsync<Revision>(
            `SELECT r.*, st.topic FROM revisions r
       JOIN study_topics st ON r.topic_id = st.id
       WHERE r.scheduled_at <= ? AND r.completed_at IS NULL
       ORDER BY r.scheduled_at ASC`,
            [today]
        );
        set({ dueRevisions: result });
    },

    addTopic: async (topic, timeSpent, confidence) => {
        const db = getDatabase();
        const id = generateId();
        const timestamp = now();
        const nextReview = calculateNextReview(0, confidence);

        const newTopic: StudyTopic = {
            id,
            topic,
            time_spent_minutes: timeSpent,
            confidence_level: confidence,
            integrity_percent: 100,
            decay_state: 'fresh',
            last_reviewed_at: timestamp,
            next_review_at: nextReview,
            review_count: 0,
            created_at: timestamp,
            updated_at: timestamp,
        };

        await db.runAsync(
            `INSERT INTO study_topics 
       (id, topic, time_spent_minutes, confidence_level, integrity_percent, decay_state, 
        last_reviewed_at, next_review_at, review_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, topic, timeSpent, confidence, 100, 'fresh', timestamp, nextReview, 0, timestamp, timestamp]
        );

        // Schedule first revision
        const revisionId = generateId();
        await db.runAsync(
            `INSERT INTO revisions (id, topic_id, scheduled_at, created_at)
       VALUES (?, ?, ?, ?)`,
            [revisionId, id, nextReview, timestamp]
        );

        // Add timeline entry
        const timelineId = generateId();
        await db.runAsync(
            `INSERT INTO timeline_entries (id, entry_type, reference_id, title, description, created_at, was_avoided)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [timelineId, 'study_session', id, topic, `Studied for ${timeSpent} minutes with ${confidence}% confidence`, timestamp, 0]
        );

        set((state) => ({ topics: [newTopic, ...state.topics] }));
        return newTopic;
    },

    updateTopic: async (id, updates) => {
        const db = getDatabase();
        const timestamp = now();

        const fields = Object.keys(updates)
            .map((key) => `${key} = ?`)
            .join(', ');
        const values = [...Object.values(updates), timestamp, id];

        await db.runAsync(
            `UPDATE study_topics SET ${fields}, updated_at = ? WHERE id = ?`,
            values
        );

        set((state) => ({
            topics: state.topics.map((t) =>
                t.id === id ? { ...t, ...updates, updated_at: timestamp } : t
            ),
        }));
    },

    deleteTopic: async (id) => {
        const db = getDatabase();
        await db.runAsync('DELETE FROM study_topics WHERE id = ?', [id]);
        set((state) => ({ topics: state.topics.filter((t) => t.id !== id) }));
    },

    completeRevision: async (revisionId, confidenceAfter) => {
        const db = getDatabase();
        const timestamp = now();

        // Get the revision and topic
        const revision = await db.getFirstAsync<Revision & { topic_id: string }>(
            'SELECT * FROM revisions WHERE id = ?',
            [revisionId]
        );

        if (!revision) return;

        const topic = await db.getFirstAsync<StudyTopic>(
            'SELECT * FROM study_topics WHERE id = ?',
            [revision.topic_id]
        );

        if (!topic) return;

        // Update revision
        await db.runAsync(
            `UPDATE revisions SET completed_at = ?, confidence_after = ?, confidence_before = ?
       WHERE id = ?`,
            [timestamp, confidenceAfter, topic.confidence_level, revisionId]
        );

        // Calculate next review
        const newReviewCount = topic.review_count + 1;
        const nextReview = calculateNextReview(newReviewCount, confidenceAfter);

        // Update topic
        await db.runAsync(
            `UPDATE study_topics SET 
       confidence_level = ?, last_reviewed_at = ?, next_review_at = ?,
       review_count = ?, integrity_percent = 100, decay_state = 'fresh', updated_at = ?
       WHERE id = ?`,
            [confidenceAfter, timestamp, nextReview, newReviewCount, timestamp, topic.id]
        );

        // Schedule next revision
        const newRevisionId = generateId();
        await db.runAsync(
            `INSERT INTO revisions (id, topic_id, scheduled_at, created_at)
       VALUES (?, ?, ?, ?)`,
            [newRevisionId, topic.id, nextReview, timestamp]
        );

        // Reload data
        await get().loadTopics();
        await get().loadDueRevisions();
    },

    markRevisionMissed: async (revisionId) => {
        const db = getDatabase();
        const timestamp = now();

        await db.runAsync(
            'UPDATE revisions SET was_missed = 1 WHERE id = ?',
            [revisionId]
        );

        // Get topic and update decay state
        const revision = await db.getFirstAsync<Revision>(
            'SELECT topic_id FROM revisions WHERE id = ?',
            [revisionId]
        );

        if (revision) {
            const topic = await db.getFirstAsync<StudyTopic>(
                'SELECT * FROM study_topics WHERE id = ?',
                [revision.topic_id]
            );

            if (topic) {
                const newDecayState = calculateDecayState(topic.last_reviewed_at || timestamp);
                const newIntegrity = Math.max(0, topic.integrity_percent - 15);

                await db.runAsync(
                    `UPDATE study_topics SET decay_state = ?, integrity_percent = ?, updated_at = ?
           WHERE id = ?`,
                    [newDecayState, newIntegrity, timestamp, topic.id]
                );

                // Add timeline entry for missed revision
                const timelineId = generateId();
                await db.runAsync(
                    `INSERT INTO timeline_entries (id, entry_type, reference_id, title, description, created_at, was_avoided)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [timelineId, 'missed_revision', revisionId, topic.topic, `Revision was missed - integrity dropped to ${newIntegrity}%`, timestamp, 1]
                );
            }
        }

        await get().loadTopics();
        await get().loadDueRevisions();
    },

    updateDecayStates: async () => {
        const db = getDatabase();
        const topics = await db.getAllAsync<StudyTopic>('SELECT * FROM study_topics');
        const timestamp = now();

        for (const topic of topics) {
            const newDecayState = calculateDecayState(topic.last_reviewed_at || topic.created_at);
            const daysSinceReview = Math.floor(
                (timestamp - (topic.last_reviewed_at || topic.created_at)) / (1000 * 60 * 60 * 24)
            );

            // Decay integrity by 2% per day since last review after the first day
            const decayAmount = Math.max(0, (daysSinceReview - 1) * 2);
            const newIntegrity = Math.max(0, 100 - decayAmount);

            if (newDecayState !== topic.decay_state || newIntegrity !== topic.integrity_percent) {
                await db.runAsync(
                    `UPDATE study_topics SET decay_state = ?, integrity_percent = ?, updated_at = ?
           WHERE id = ?`,
                    [newDecayState, newIntegrity, timestamp, topic.id]
                );
            }
        }

        await get().loadTopics();
    },
}));
