import { z } from 'zod';
import { QueryBuilder, TableSchema } from './QueryBuilder';
import { IDatabaseAdapter, TableDefinition } from './Table';
import { IServiceBroker, ContextStack } from 'isomorphic-core';

/**
 * BaseRepository — A generic CRUD layer with automatic tenant isolation.
 */
export class BaseRepository<T extends z.ZodObject<any>> {
    protected table: TableDefinition<T>;

    constructor(
        tableName: string,
        schema: T,
        protected adapter: IDatabaseAdapter,
        protected broker?: IServiceBroker
    ) {
        this.table = { name: tableName, schema };
    }

    /**
     * Creates a new instance of the query builder for this table.
     * Automatically applies tenant filtering if context is available.
     */
    protected builder(): QueryBuilder<T> {
        return new QueryBuilder(this.table, this.adapter, true, this.broker);
    }

    /**
     * Extracts the tenant_id from the active ServiceBroker context.
     */
    protected getTenantId(): string | undefined {
        const ctx = this.broker?.getContext() || ContextStack.getContext();
        if (!ctx) return undefined;

        // Try different meta paths for tenant identity
        return (ctx.meta as any)?.user?.tenant_id || (ctx.meta as any)?.tenant_id;
    }

    /**
     * Task 17: Create a new record with runtime validation.
     */
    async create(data: TableSchema<T>): Promise<TableSchema<T>> {
        // Full runtime validation
        const validated = this.table.schema.parse(data);
        const { id } = await this.builder().insert(validated);
        return { ...validated, id } as any;
    }

    /**
     * Task 17: Find many records matching a partial filter.
     */
    async find(filter: Partial<TableSchema<T>> = {}): Promise<TableSchema<T>[]> {
        const qb = this.builder();
        
        for (const [key, value] of Object.entries(filter)) {
            if (value !== undefined) {
                qb.where(key as any, '=', value);
            }
        }

        return await qb.execute();
    }

    /**
     * Task 17: Update records matching the given ID.
     */
    async update(id: string | number, data: Partial<TableSchema<T>>): Promise<void> {
        await this.builder()
            .where('id' as any, '=', id)
            .update(data);
    }

    /**
     * Task 17: Remove records matching the given ID.
     */
    async remove(id: string | number): Promise<void> {
        await this.builder()
            .where('id' as any, '=', id)
            .delete();
    }

    /**
     * Find a single record by its ID.
     */
    async findById(id: string | number): Promise<TableSchema<T> | null> {
        const results = await this.find({ id } as any);
        return results[0] || null;
    }

    /**
     * Find a single record matching a partial filter.
     */
    async findOne(filter: Partial<TableSchema<T>>): Promise<TableSchema<T> | null> {
        const results = await this.find(filter);
        return results[0] || null;
    }
}
