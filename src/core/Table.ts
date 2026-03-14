import { z } from 'zod';
import { IDatabaseAdapter, DatabaseResult } from '../interfaces/IDatabaseAdapter';

export { IDatabaseAdapter, DatabaseResult };

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
