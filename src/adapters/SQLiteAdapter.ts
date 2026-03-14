import { IDatabaseAdapter, DatabaseResult } from '../interfaces/IDatabaseAdapter';

/**
 * SQLiteAdapter — Structural swap for SQLite database engine.
 * Note: This implementation is a placeholder for environment-specific SQLite drivers.
 */
export class SQLiteAdapter implements IDatabaseAdapter {
    public name = 'native-sqlite';
    private db: any;

    constructor(private filename: string) {
        // In a real scenario, initialize better-sqlite3 or similar here.
        console.log(`[SQLiteAdapter] Initialized with file: ${this.filename}`);
    }

    async query<T>(sql: string, params: unknown[]): Promise<T[]> {
        console.log(`[SQLiteAdapter] Query: ${sql}`, params);
        return []; // Placeholder
    }

    async run(sql: string, params: unknown[]): Promise<DatabaseResult> {
        console.log(`[SQLiteAdapter] Run: ${sql}`, params);
        return { changes: 0 }; // Placeholder
    }

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
        return fn(); // Placeholder
    }
}
