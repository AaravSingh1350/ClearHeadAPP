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

    return db;
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
