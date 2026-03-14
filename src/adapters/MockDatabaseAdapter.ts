import { IDatabaseAdapter, DatabaseResult } from '../interfaces/IDatabaseAdapter';

/**
 * MockDatabaseAdapter — In-memory mock for testing.
 */
export class MockDatabaseAdapter implements IDatabaseAdapter {
    public name = 'mock-db';
    public queries: { sql: string, params: unknown[] }[] = [];
    public results: any[] = [];

    async query<T>(sql: string, params: unknown[]): Promise<T[]> {
        this.queries.push({ sql, params });
        return this.results as T[];
    }

    async run(sql: string, params: unknown[]): Promise<DatabaseResult> {
        this.queries.push({ sql, params });
        return { changes: 0 };
    }

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
        return fn();
    }
}
