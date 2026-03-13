import { z } from 'zod';
import { IDatabaseAdapter, TableDefinition } from './Table';
import { InferZod, IServiceBroker, ReactiveState } from 'isomorphic-core';

export type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=';

/**
 * Extracts the raw object shape from a Zod Schema for use in the Builder.
 */
export type TableSchema<T extends z.ZodObject<any>> = InferZod<T>;

/**
 * Narrowing type for Column Selection.
 * Ensures you can only select keys that actually exist on the Zod object.
 */
export type ColumnOf<T extends z.ZodObject<any>> = keyof TableSchema<T>;

interface Filter {
    column: string;
    operator: FilterOperator;
    value: any;
}

/**
 * QueryBuilder — A type-safe fluent interface for database operations.
 */
export class QueryBuilder<T extends z.ZodObject<any>, R = z.infer<T>> {
    private selectedColumns: string[] = [];
    private filters: Filter[] = [];
    private limitValue?: number;
    private offsetValue?: number;
    private tenantIdOverride?: string;

    constructor(
        private table: TableDefinition<T>,
        private adapter: IDatabaseAdapter,
        private enforceTenancy: boolean = false,
        private broker?: IServiceBroker
    ) {}

    /** Set the tenant context for this query (overrides dynamic context) */
    forTenant(id: string): this {
        this.tenantIdOverride = id;
        return this;
    }

    /** Select specific columns */
    select<K extends ColumnOf<T>>(columns: K[]): QueryBuilder<T, Pick<TableSchema<T>, K>> {
        this.selectedColumns = columns as string[];
        return this as any;
    }

    /** Add a where clause with type-safe value checking */
    where<K extends ColumnOf<T>>(
        column: K, 
        operator: FilterOperator, 
        value: TableSchema<T>[K]
    ): this {
        this.filters.push({ column: column as string, operator, value });
        return this;
    }

    limit(n: number): this {
        this.limitValue = n;
        return this;
    }

    offset(n: number): this {
        this.offsetValue = n;
        return this;
    }

    /** Insert data with runtime validation */
    async insert(data: Partial<z.infer<T>>): Promise<{ id?: number | string }> {
        // Validate against schema
        const validated = this.table.schema.partial().parse(data);
        
        // Add tenant_id if required
        if (this.enforceTenancy) {
            const tid = this.getTenantId();
            if (tid) {
                (validated as any).tenant_id = tid;
            }
        }

        const keys = Object.keys(validated);
        const values = Object.values(validated);
        const placeholders = keys.map(() => '?').join(', ');
        
        const sql = `INSERT INTO ${this.table.name} (${keys.join(', ')}) VALUES (${placeholders})`;
        const res = await this.adapter.run(sql, values);
        
        this.notifyMutation('insert');
        return { id: res.lastInsertId };
    }

    /** Update data with filters and validation */
    async update(data: Partial<z.infer<T>>): Promise<{ changes: number }> {
        const validated = this.table.schema.partial().parse(data);
        
        const sets: string[] = [];
        const params: any[] = [];

        for (const [key, val] of Object.entries(validated)) {
            sets.push(`${key} = ?`);
            params.push(val);
        }

        let sql = `UPDATE ${this.table.name} SET ${sets.join(', ')}`;
        
        const { whereClause, whereParams } = this.buildWhereClause();
        if (whereClause) {
            sql += ` WHERE ${whereClause}`;
            params.push(...whereParams);
        }

        const res = await this.adapter.run(sql, params);
        
        this.notifyMutation('update');
        return { changes: res.changes };
    }

    /** Delete records matching current filters */
    async delete(): Promise<{ changes: number }> {
        let sql = `DELETE FROM ${this.table.name}`;
        
        const { whereClause, whereParams } = this.buildWhereClause();
        if (whereClause) {
            sql += ` WHERE ${whereClause}`;
        }

        const res = await this.adapter.run(sql, whereParams);
        
        this.notifyMutation('delete');
        return { changes: res.changes };
    }

    /**
     * Live Query Bridge.
     * Returns a results set that automatically stays in sync via $db.mutated events.
     */
    public liveQuery(): { results: R[] } {
        const state = new ReactiveState<{ results: R[] }>({ results: [] });

        const refresh = async () => {
            state.data.results = await this.execute();
        };

        // Initial fetch
        refresh();

        // Subscribe to global mutation events for this table
        const unsub = this.broker?.on(`$db.${this.table.name}.mutated`, () => refresh());
        
        return state.data;
    }

    /**
     * Batch execution to reduce WASM overhead.
     */
    public async batch(operations: (qb: this) => Promise<void>): Promise<void> {
        // Simple implementation: wrap in transaction if supported by adapter
        if (this.adapter.transaction) {
            return this.adapter.transaction(() => operations(this));
        }
        return operations(this);
    }

    private notifyMutation(type: string): void {
        if (this.broker) {
            this.broker.emit(`$db.${this.table.name}.mutated`, { 
                type, 
                table: this.table.name,
                tenantId: this.getTenantId()
            } as any);
        }
    }

    /** Finalize and execute the SELECT query */
    async execute(): Promise<R[]> {
        const cols = this.selectedColumns.length > 0 ? this.selectedColumns.join(', ') : '*';
        let sql = `SELECT ${cols} FROM ${this.table.name}`;
        
        const { whereClause, whereParams } = this.buildWhereClause();
        if (whereClause) {
            sql += ` WHERE ${whereClause}`;
        }

        if (this.limitValue !== undefined) {
            sql += ` LIMIT ${this.limitValue}`;
        }
        if (this.offsetValue !== undefined) {
            sql += ` OFFSET ${this.offsetValue}`;
        }

        const rows = await this.adapter.query<any>(sql, whereParams);

        // Task 15: Perform runtime validation (optional mapping)
        // If we selected specific columns, we can't use the full schema validation
        // unless we use a partial schema or a dynamic one.
        if (this.selectedColumns.length === 0) {
            return rows.map(row => this.table.schema.parse(row)) as unknown as R[];
        }

        return rows as R[];
    }

    private getTenantId(): string | undefined {
        const context = this.broker?.getContext();
        const meta = context?.meta as any;
        const dynamicTenantId = meta?.user?.tenant_id || meta?.tenant_id;
        return this.tenantIdOverride || dynamicTenantId;
    }

    private buildWhereClause(): { whereClause: string; whereParams: any[] } {
        const clauses: string[] = [];
        const params: any[] = [];

        // Integrated Multi-Tenancy (Task 14)
        if (this.enforceTenancy) {
            const tid = this.getTenantId();
            if (tid) {
                clauses.push(`tenant_id = ?`);
                params.push(tid);
            }
        }

        for (const f of this.filters) {
            clauses.push(`${f.column} ${f.operator} ?`);
            params.push(f.value);
        }

        return {
            whereClause: clauses.join(' AND '),
            whereParams: params
        };
    }
}
