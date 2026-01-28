// Planner store for tasks and time blocks
import { create } from 'zustand';
import { Task, TimeBlock, Habit } from '@/database/schema';
import { getDatabase, generateId, now, formatDate } from '@/database';

interface PlannerState {
    tasks: Task[];
    timeBlocks: TimeBlock[];
    todayTasks: Task[];
    habits: Habit[];
    isLoading: boolean;

    // Actions
    // Actions
    loadTasks: (date?: string) => Promise<void>;
    loadTimeBlocks: (date: string) => Promise<void>;
    loadTodayTasks: () => Promise<void>;
    loadHabits: () => Promise<void>;

    addTask: (name: string, timeEstimate: number, date?: string, priority?: 1 | 2 | 3, isHabit?: boolean, habitId?: string, startTime?: number, scheduledTime?: string) => Promise<Task>;
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;

    completeTask: (id: string) => Promise<void>;
    skipTask: (id: string) => Promise<void>; // Just marks as skipped, stays in today
    undoTask: (id: string) => Promise<void>; // Undo completed/skipped task

    addTimeBlock: (date: string, startTime: number, endTime: number, taskId?: string) => Promise<TimeBlock>;
    updateTimeBlock: (id: string, updates: Partial<TimeBlock>) => Promise<void>;
    deleteTimeBlock: (id: string) => Promise<void>;

    lockPastBlocks: () => Promise<void>;
    markMissedBlocks: () => Promise<void>;

    // Habits
    addHabit: (name: string, timeEstimate: number) => Promise<Habit>;
    updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
    deleteHabit: (id: string) => Promise<void>;
    addHabitsToDate: (date: string) => Promise<void>;

    // Dashboard Stats
    overdueTasksCount: number;
    loadOverdueTasksCount: () => Promise<void>;

    // Copy tasks
    copyYesterdayTasks: (toDate: string) => Promise<number>;
    getPendingTasksForDate: (date: string) => Promise<Task[]>;
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
    tasks: [],
    timeBlocks: [],
    todayTasks: [],
    habits: [],
    isLoading: false,
    overdueTasksCount: 0,

    loadOverdueTasksCount: async () => {
        const db = getDatabase();
        const today = formatDate(Date.now());

        // Count tasks scheduled before today that are pending or in_progress
        // and NOT recovery tasks (optional choice, but usually standard tasks)
        const result = await db.getAllAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM tasks
             WHERE scheduled_date < ?
             AND status IN ('pending', 'in_progress')
             AND is_recovery = 0`,
            [today]
        );

        set({ overdueTasksCount: result[0]?.count || 0 });
    },

    loadTasks: async (date) => {
        set({ isLoading: true });
        try {
            const db = getDatabase();
            let query = 'SELECT * FROM tasks ORDER BY scheduled_time ASC NULLS LAST, priority ASC, created_at DESC';
            let params: any[] = [];

            if (date) {
                query = 'SELECT * FROM tasks WHERE scheduled_date = ? ORDER BY scheduled_time ASC NULLS LAST, priority ASC, created_at DESC';
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

    loadHabits: async () => {
        try {
            const db = getDatabase();
            const result = await db.getAllAsync<Habit>(
                'SELECT * FROM habits WHERE is_active = 1 ORDER BY created_at ASC'
            );
            set({ habits: result });
        } catch (error) {
            console.error('Failed to load habits:', error);
        }
    },

    addTask: async (name, timeEstimate, date, priority, isHabit = false, habitId, startTime, scheduledTime) => {
        const db = getDatabase();
        const { addTimeBlock } = get();
        const id = generateId();
        const timestamp = now();
        const habitIdValue = habitId || null;

        const task: Task = {
            id,
            name,
            time_estimate_minutes: timeEstimate,
            decay_cost: 1,
            is_recovery: false,
            is_habit: isHabit,
            habit_id: habitIdValue,
            original_task_id: null,
            status: 'pending',
            scheduled_date: date || null,
            scheduled_time: scheduledTime || null,
            priority: priority || null,
            completed_at: null,
            skipped_at: null,
            created_at: timestamp,
            updated_at: timestamp,
        };

        await db.runAsync(
            `INSERT INTO tasks 
       (id, name, time_estimate_minutes, decay_cost, is_recovery, is_habit, habit_id, original_task_id,
        status, scheduled_date, scheduled_time, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, name, timeEstimate, 1, 0, isHabit ? 1 : 0, habitIdValue, null, 'pending', date || null, scheduledTime || null, priority || null, timestamp, timestamp]
        );

        // If startTime is provided and date is set, create a time block
        if (startTime && date && timeEstimate > 0) {
            const endTime = startTime + timeEstimate * 60 * 1000;
            await addTimeBlock(date, startTime, endTime, id);
        }

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
        const timestamp = now();
        const deleteDate = new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        // Get task from state for timeline
        const task = get().tasks.find(t => t.id === id);

        // Optimistic delete
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));

        // Database operations
        await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);

        // Check if timeline entry already exists for this task
        if (task) {
            const existingEntry = await db.getFirstAsync<{ id: string }>(
                'SELECT id FROM timeline_entries WHERE reference_id = ?',
                [id]
            );

            if (existingEntry) {
                // Update existing entry with (deleted) marker
                await db.runAsync(
                    `UPDATE timeline_entries SET title = ?, description = ?, was_avoided = 1 WHERE reference_id = ?`,
                    [`${task.name} (deleted ${deleteDate})`, 'Task was deleted', id]
                );
            } else {
                // Create new entry
                const timelineId = generateId();
                await db.runAsync(
                    `INSERT INTO timeline_entries (id, entry_type, reference_id, title, description, created_at, was_avoided)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [timelineId, 'planner_failure', id, `${task.name} (deleted ${deleteDate})`, 'Task deleted', timestamp, 1]
                );
            }
        }
    },

    completeTask: async (id) => {
        const db = getDatabase();
        const timestamp = now();

        // Get task from state
        const task = get().tasks.find(t => t.id === id);

        // Optimistic update
        set((state) => ({
            tasks: state.tasks.map((t) =>
                t.id === id ? { ...t, status: 'completed' as const, completed_at: timestamp, updated_at: timestamp } : t
            ),
        }));

        // Database operations
        await db.runAsync(
            `UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`,
            [timestamp, timestamp, id]
        );

        // Add timeline entry for completion
        if (task) {
            const timelineId = generateId();
            await db.runAsync(
                `INSERT INTO timeline_entries (id, entry_type, reference_id, title, description, created_at, was_avoided)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [timelineId, 'study_session', id, task.name, 'Task completed', timestamp, 0]
            );
        }
    },

    skipTask: async (id) => {
        const db = getDatabase();
        const timestamp = now();

        // Get task from state
        const currentTasks = get().tasks;
        const task = currentTasks.find(t => t.id === id);
        if (!task) throw new Error('Task not found');

        // OPTIMISTIC UPDATE - Mark as skipped but keep same date (stays in today)
        set((state) => ({
            tasks: state.tasks.map((t) =>
                t.id === id ? { ...t, status: 'skipped' as const, skipped_at: timestamp, updated_at: timestamp } : t
            ),
        }));

        // Database operations
        try {
            await db.runAsync(
                `UPDATE tasks SET status = 'skipped', skipped_at = ?, updated_at = ? WHERE id = ?`,
                [timestamp, timestamp, id]
            );

            // Add timeline entry
            const timelineId = generateId();
            await db.runAsync(
                `INSERT INTO timeline_entries (id, entry_type, reference_id, title, description, created_at, was_avoided)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [timelineId, 'planner_failure', id, task.name, 'Task skipped', timestamp, 1]
            );
        } catch (error) {
            console.error('Skip task failed:', error);
            await get().loadTasks();
        }
    },

    undoTask: async (id) => {
        const db = getDatabase();
        const timestamp = now();

        // Get the task from current state
        const currentTasks = get().tasks;
        const task = currentTasks.find(t => t.id === id);

        if (!task) throw new Error('Task not found');

        // OPTIMISTIC UPDATE - Update UI immediately
        set((state) => ({
            tasks: state.tasks
                .map((t) => t.id === id
                    ? { ...t, status: 'pending' as const, completed_at: null, skipped_at: null, updated_at: timestamp }
                    : t
                )
                // Remove recovery task if it was a skipped task
                .filter(t => !(task.status === 'skipped' && t.original_task_id === id && t.is_recovery)),
        }));

        // Database operations in background
        try {
            await db.runAsync(
                `UPDATE tasks SET status = 'pending', completed_at = NULL, skipped_at = NULL, updated_at = ? WHERE id = ?`,
                [timestamp, id]
            );

            if (task.status === 'skipped') {
                await db.runAsync(
                    'DELETE FROM tasks WHERE original_task_id = ? AND is_recovery = 1',
                    [id]
                );
            }

            // Delete timeline entry for this task (undo means it never happened)
            await db.runAsync(
                'DELETE FROM timeline_entries WHERE reference_id = ?',
                [id]
            );
        } catch (error) {
            console.error('Undo task failed:', error);
            await get().loadTasks();
        }
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

    // Habits
    addHabit: async (name, timeEstimate) => {
        const db = getDatabase();
        const id = generateId();
        const timestamp = now();

        const habit: Habit = {
            id,
            name,
            time_estimate_minutes: timeEstimate,
            is_active: true,
            created_at: timestamp,
            updated_at: timestamp,
        };

        await db.runAsync(
            `INSERT INTO habits (id, name, time_estimate_minutes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id, name, timeEstimate, 1, timestamp, timestamp]
        );

        set((state) => ({ habits: [...state.habits, habit] }));
        return habit;
    },

    updateHabit: async (id, updates) => {
        const db = getDatabase();
        const timestamp = now();

        const fields = Object.keys(updates)
            .map((key) => `${key} = ?`)
            .join(', ');
        const values = [...Object.values(updates), timestamp, id];

        await db.runAsync(
            `UPDATE habits SET ${fields}, updated_at = ? WHERE id = ?`,
            values
        );

        set((state) => ({
            habits: state.habits.map((h) =>
                h.id === id ? { ...h, ...updates, updated_at: timestamp } : h
            ),
        }));
    },

    deleteHabit: async (id) => {
        const db = getDatabase();
        await db.runAsync('UPDATE habits SET is_active = 0 WHERE id = ?', [id]);
        set((state) => ({ habits: state.habits.filter((h) => h.id !== id) }));
    },

    addHabitsToDate: async (date) => {
        const { habits, addTask } = get();
        for (const habit of habits) {
            await addTask(habit.name, habit.time_estimate_minutes, date, undefined, true, habit.id);
        }
    },

    // Copy yesterday's tasks
    copyYesterdayTasks: async (toDate) => {
        const db = getDatabase();
        const { addTask } = get();

        // Calculate yesterday's date
        const toDateObj = new Date(toDate);
        toDateObj.setDate(toDateObj.getDate() - 1);
        const yesterdayDate = formatDate(toDateObj.getTime());

        // Get yesterday's pending tasks (not completed, not skipped)
        const tasks = await db.getAllAsync<Task>(
            `SELECT * FROM tasks 
       WHERE scheduled_date = ? AND status IN ('pending', 'in_progress')
       ORDER BY priority ASC`,
            [yesterdayDate]
        );

        let copiedCount = 0;
        for (const task of tasks) {
            // Don't copy recovery tasks
            if (!task.is_recovery) {
                await addTask(
                    task.name,
                    task.time_estimate_minutes,
                    toDate,
                    task.priority || undefined,
                    task.is_habit,
                    task.habit_id || undefined
                );
                copiedCount++;
            }
        }

        return copiedCount;
    },

    getPendingTasksForDate: async (date) => {
        const db = getDatabase();
        const result = await db.getAllAsync<Task>(
            `SELECT * FROM tasks 
       WHERE scheduled_date = ? AND status IN ('pending', 'in_progress')
       ORDER BY priority ASC`,
            [date]
        );
        return result.filter(t => !t.is_recovery); // Filter out recovery tasks
    },
}));
