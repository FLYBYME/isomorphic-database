export interface DatabaseResult {
    lastInsertId?: number | string;
    changes: number;
}

/**
 * IDatabaseAdapter — Abstract interface for pluggable database engines.
 */
export interface IDatabaseAdapter {
    name: string;
    query<T = unknown>(sql: string, params: unknown[]): Promise<T[]>;
    run(sql: string, params: unknown[]): Promise<DatabaseResult>;
    transaction?<T>(fn: () => Promise<T>): Promise<T>;
}
