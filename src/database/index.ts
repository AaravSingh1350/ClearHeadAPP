// Database initialization and connection management
import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, DATABASE_NAME } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

// Initialize database connection
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (db) return db;

    db = await SQLite.openDatabaseAsync(DATABASE_NAME);

    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Create tables
    await db.execAsync(CREATE_TABLES_SQL);

    // Run migrations for CogniFlow upgrade
    await runMigrations(db);

    return db;
}

// Run database migrations
async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
    try {
        // Check if level column exists
        const tableInfo = await database.getAllAsync<{ name: string }>(
            "PRAGMA table_info(study_topics)"
        );
        const columnNames = tableInfo.map(col => col.name);

        // Add level column if missing
        if (!columnNames.includes('level')) {
            await database.execAsync('ALTER TABLE study_topics ADD COLUMN level INTEGER NOT NULL DEFAULT 0');
        }

        // Add priority column if missing
        if (!columnNames.includes('priority')) {
            await database.execAsync("ALTER TABLE study_topics ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'");
        }

        // Add tags column if missing
        if (!columnNames.includes('tags')) {
            await database.execAsync('ALTER TABLE study_topics ADD COLUMN tags TEXT');
        }

        // Add is_mastered column if missing
        if (!columnNames.includes('is_mastered')) {
            await database.execAsync('ALTER TABLE study_topics ADD COLUMN is_mastered INTEGER NOT NULL DEFAULT 0');
        }

        // Tasks table migrations
        const tasksInfo = await database.getAllAsync<{ name: string }>(
            "PRAGMA table_info(tasks)"
        );
        const taskColumns = tasksInfo.map(col => col.name);

        // Add scheduled_time column if missing
        if (!taskColumns.includes('scheduled_time')) {
            await database.execAsync('ALTER TABLE tasks ADD COLUMN scheduled_time TEXT');
        }

        // Add is_habit column if missing
        if (!taskColumns.includes('is_habit')) {
            await database.execAsync('ALTER TABLE tasks ADD COLUMN is_habit INTEGER NOT NULL DEFAULT 0');
        }

        // Add is_recovery column if missing
        if (!taskColumns.includes('is_recovery')) {
            await database.execAsync('ALTER TABLE tasks ADD COLUMN is_recovery INTEGER NOT NULL DEFAULT 0');
        }

        // Add decay_cost column if missing
        if (!taskColumns.includes('decay_cost')) {
            await database.execAsync('ALTER TABLE tasks ADD COLUMN decay_cost INTEGER NOT NULL DEFAULT 1');
        }

        // Add original_task_id column if missing
        if (!taskColumns.includes('original_task_id')) {
            await database.execAsync('ALTER TABLE tasks ADD COLUMN original_task_id TEXT');
        }

        // Add habit_id column if missing
        if (!taskColumns.includes('habit_id')) {
            await database.execAsync('ALTER TABLE tasks ADD COLUMN habit_id TEXT');
        }

        console.log('All migrations completed successfully');
    } catch (error) {
        console.error('Migration error:', error);
    }
}

// Get database instance
export function getDatabase(): SQLite.SQLiteDatabase {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

// Close database connection
export async function closeDatabase(): Promise<void> {
    if (db) {
        await db.closeAsync();
        db = null;
    }
}

// Generate UUID for records
export function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Get current timestamp in milliseconds
export function now(): number {
    return Date.now();
}

// Format date as YYYY-MM-DD
export function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
}

// Parse date string to timestamp
export function parseDate(dateStr: string): number {
    return new Date(dateStr).getTime();
}
