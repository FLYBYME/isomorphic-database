import { z } from 'zod';

export interface DatabaseResult {
    lastInsertId?: number | string;
    changes: number;
}

/**
 * IDatabaseAdapter — Abstract interface for pluggable database engines.
 */
export interface IDatabaseAdapter {
    query<T = unknown>(sql: string, params: unknown[]): Promise<T[]>;
    run(sql: string, params: unknown[]): Promise<DatabaseResult>;
    transaction?<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * TableDefinition — Stores the metadata and schema for a table.
 */
export interface TableDefinition<T extends z.ZodObject<any>> {
    name: string;
    schema: T;
}

/**
 * defineTable — Creates a type-safe table definition from a Zod schema.
 */
export function defineTable<T extends z.ZodObject<any>>(name: string, schema: T): TableDefinition<T> {
    return { name, schema };
}
