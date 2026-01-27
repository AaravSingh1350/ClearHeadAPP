// Planner store for tasks and time blocks
import { create } from 'zustand';
import { Task, TimeBlock } from '@/database/schema';
import { getDatabase, generateId, now, formatDate } from '@/database';

interface PlannerState {
    tasks: Task[];
    timeBlocks: TimeBlock[];
    todayTasks: Task[];
    isLoading: boolean;

    // Actions
    loadTasks: (date?: string) => Promise<void>;
    loadTimeBlocks: (date: string) => Promise<void>;
    loadTodayTasks: () => Promise<void>;

    addTask: (name: string, timeEstimate: number, date?: string, priority?: 1 | 2 | 3) => Promise<Task>;
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;

    completeTask: (id: string) => Promise<void>;
    skipTask: (id: string) => Promise<Task>; // Returns the recovery task

    addTimeBlock: (date: string, startTime: number, endTime: number, taskId?: string) => Promise<TimeBlock>;
    updateTimeBlock: (id: string, updates: Partial<TimeBlock>) => Promise<void>;
    deleteTimeBlock: (id: string) => Promise<void>;

    lockPastBlocks: () => Promise<void>;
    markMissedBlocks: () => Promise<void>;
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
    tasks: [],
    timeBlocks: [],
    todayTasks: [],
    isLoading: false,

    loadTasks: async (date) => {
        set({ isLoading: true });
        try {
            const db = getDatabase();
            let query = 'SELECT * FROM tasks ORDER BY priority ASC, created_at DESC';
            let params: any[] = [];

            if (date) {
                query = 'SELECT * FROM tasks WHERE scheduled_date = ? ORDER BY priority ASC, created_at DESC';
                params = [date];
            }

            const result = await db.getAllAsync<Task>(query, params);
            set({ tasks: result, isLoading: false });
        } catch (error) {
            console.error('Failed to load tasks:', error);
            set({ isLoading: false });
        }
    },

    loadTimeBlocks: async (date) => {
        const db = getDatabase();
        const result = await db.getAllAsync<TimeBlock>(
            'SELECT * FROM time_blocks WHERE date = ? ORDER BY start_time ASC',
            [date]
        );
        set({ timeBlocks: result });
    },

    loadTodayTasks: async () => {
        const db = getDatabase();
        const today = formatDate(now());
        const result = await db.getAllAsync<Task>(
            `SELECT * FROM tasks 
       WHERE scheduled_date = ? AND status IN ('pending', 'in_progress')
       ORDER BY priority ASC`,
            [today]
        );
        set({ todayTasks: result });
    },

    addTask: async (name, timeEstimate, date, priority) => {
        const db = getDatabase();
        const id = generateId();
        const timestamp = now();

        const task: Task = {
            id,
            name,
            time_estimate_minutes: timeEstimate,
            decay_cost: 1,
            is_recovery: false,
            original_task_id: null,
            status: 'pending',
            scheduled_date: date || null,
            priority: priority || null,
            completed_at: null,
            skipped_at: null,
            created_at: timestamp,
            updated_at: timestamp,
        };

        await db.runAsync(
            `INSERT INTO tasks 
       (id, name, time_estimate_minutes, decay_cost, is_recovery, original_task_id,
        status, scheduled_date, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, name, timeEstimate, 1, 0, null, 'pending', date || null, priority || null, timestamp, timestamp]
        );

        set((state) => ({ tasks: [task, ...state.tasks] }));
        return task;
    },

    updateTask: async (id, updates) => {
        const db = getDatabase();
        const timestamp = now();

        const fields = Object.keys(updates)
            .map((key) => `${key} = ?`)
            .join(', ');
        const values = [...Object.values(updates), timestamp, id];

        await db.runAsync(
            `UPDATE tasks SET ${fields}, updated_at = ? WHERE id = ?`,
            values
        );

        set((state) => ({
            tasks: state.tasks.map((t) =>
                t.id === id ? { ...t, ...updates, updated_at: timestamp } : t
            ),
        }));
    },

    deleteTask: async (id) => {
        const db = getDatabase();
        await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    },

    completeTask: async (id) => {
        const db = getDatabase();
        const timestamp = now();

        // Get task name for timeline
        const task = await db.getFirstAsync<Task>(
            'SELECT * FROM tasks WHERE id = ?',
            [id]
        );

        await db.runAsync(
            `UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`,
            [timestamp, timestamp, id]
        );

        set((state) => ({
            tasks: state.tasks.map((t) =>
                t.id === id ? { ...t, status: 'completed', completed_at: timestamp, updated_at: timestamp } : t
            ),
        }));
    },

    skipTask: async (id) => {
        const db = getDatabase();
        const timestamp = now();

        // Get the original task
        const originalTask = await db.getFirstAsync<Task>(
            'SELECT * FROM tasks WHERE id = ?',
            [id]
        );

        if (!originalTask) throw new Error('Task not found');

        // Mark original as skipped
        await db.runAsync(
            `UPDATE tasks SET status = 'skipped', skipped_at = ?, updated_at = ? WHERE id = ?`,
            [timestamp, timestamp, id]
        );

        // Create recovery task with higher cost
        const recoveryId = generateId();
        const newDecayCost = originalTask.decay_cost + 2;
        const tomorrow = new Date(timestamp + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const recoveryTask: Task = {
            id: recoveryId,
            name: `[Recovery] ${originalTask.name}`,
            time_estimate_minutes: Math.ceil(originalTask.time_estimate_minutes * 1.25),
            decay_cost: newDecayCost,
            is_recovery: true,
            original_task_id: id,
            status: 'pending',
            scheduled_date: tomorrow,
            priority: 1, // Highest priority
            completed_at: null,
            skipped_at: null,
            created_at: timestamp,
            updated_at: timestamp,
        };

        await db.runAsync(
            `INSERT INTO tasks 
       (id, name, time_estimate_minutes, decay_cost, is_recovery, original_task_id,
        status, scheduled_date, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                recoveryId, recoveryTask.name, recoveryTask.time_estimate_minutes,
                newDecayCost, 1, id, 'pending', tomorrow, 1, timestamp, timestamp
            ]
        );

        // Add timeline entry for skipped task (planner failure)
        const timelineId = generateId();
        await db.runAsync(
            `INSERT INTO timeline_entries (id, entry_type, reference_id, title, description, created_at, was_avoided)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [timelineId, 'planner_failure', id, originalTask.name, `Task skipped - recovery task created with decay cost ${newDecayCost}`, timestamp, 1]
        );

        await get().loadTasks();
        return recoveryTask;
    },

    addTimeBlock: async (date, startTime, endTime, taskId) => {
        const db = getDatabase();
        const id = generateId();
        const timestamp = now();

        const block: TimeBlock = {
            id,
            task_id: taskId || null,
            start_time: startTime,
            end_time: endTime,
            is_locked: false,
            was_missed: false,
            date,
            created_at: timestamp,
            updated_at: timestamp,
        };

        await db.runAsync(
            `INSERT INTO time_blocks 
       (id, task_id, start_time, end_time, is_locked, was_missed, date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, taskId || null, startTime, endTime, 0, 0, date, timestamp, timestamp]
        );

        set((state) => ({ timeBlocks: [...state.timeBlocks, block].sort((a, b) => a.start_time - b.start_time) }));
        return block;
    },

    updateTimeBlock: async (id, updates) => {
        const db = getDatabase();
        const timestamp = now();

        const fields = Object.keys(updates)
            .map((key) => `${key} = ?`)
            .join(', ');
        const values = [...Object.values(updates), timestamp, id];

        await db.runAsync(
            `UPDATE time_blocks SET ${fields}, updated_at = ? WHERE id = ?`,
            values
        );

        set((state) => ({
            timeBlocks: state.timeBlocks.map((b) =>
                b.id === id ? { ...b, ...updates, updated_at: timestamp } : b
            ),
        }));
    },

    deleteTimeBlock: async (id) => {
        const db = getDatabase();
        await db.runAsync('DELETE FROM time_blocks WHERE id = ?', [id]);
        set((state) => ({ timeBlocks: state.timeBlocks.filter((b) => b.id !== id) }));
    },

    lockPastBlocks: async () => {
        const db = getDatabase();
        const timestamp = now();
        const today = formatDate(timestamp);

        await db.runAsync(
            `UPDATE time_blocks SET is_locked = 1, updated_at = ?
       WHERE date < ? OR (date = ? AND end_time < ?)`,
            [timestamp, today, today, timestamp]
        );
    },

    markMissedBlocks: async () => {
        const db = getDatabase();
        const timestamp = now();
        const today = formatDate(timestamp);

        // Mark blocks as missed if they're past and have an incomplete task
        await db.runAsync(
            `UPDATE time_blocks SET was_missed = 1, updated_at = ?
       WHERE is_locked = 1 AND task_id IS NOT NULL
       AND task_id IN (SELECT id FROM tasks WHERE status NOT IN ('completed'))`,
            [timestamp]
        );
    },
}));
