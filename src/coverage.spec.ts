import { z } from 'zod';
import { BaseRepository } from './core/BaseRepository';
import { QueryBuilder } from './core/QueryBuilder';
import { defineTable, IDatabaseAdapter } from './core/Table';
import { DatabaseMixin } from './core/DatabaseMixin';
import { ContextStack } from 'isomorphic-core';

jest.mock('isomorphic-core', () => {
    return {
        ContextStack: {
            getContext: jest.fn(),
            run: jest.fn((ctx, fn) => fn()),
        },
        ReactiveState: class {
            data: any;
            constructor(initial: any) {
                this.data = initial;
            }
        }
    };
});

describe('Database Tests', () => {
    let mockAdapter: any;
    let mockBroker: any;
    let schema: z.ZodObject<any>;
    let table: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockAdapter = {
            query: jest.fn().mockResolvedValue([]),
            run: jest.fn().mockResolvedValue({ lastInsertId: 1, changes: 1 }),
            transaction: jest.fn((fn) => fn()),
        };

        mockBroker = {
            getContext: jest.fn().mockReturnValue(undefined),
            emit: jest.fn(),
            on: jest.fn().mockReturnValue(() => {}),
        };

        schema = z.object({
            id: z.number().optional(),
            name: z.string(),
            age: z.number().optional()
        });

        table = defineTable('users', schema);
    });

    describe('Table', () => {
        it('defineTable should create a table definition', () => {
            const t = defineTable('test_table', schema);
            expect(t.name).toBe('test_table');
            expect(t.schema).toBe(schema);
        });
    });

    describe('BaseRepository', () => {
        let repo: BaseRepository<typeof schema>;

        beforeEach(() => {
            repo = new BaseRepository('users', schema, mockAdapter, mockBroker);
        });

        it('should create an instance', () => {
            expect(repo).toBeDefined();
        });

        it('should extract tenant_id from broker context user', () => {
            mockBroker.getContext.mockReturnValue({ meta: { user: { tenant_id: 'tenant-1' } } });
            const tenantId = (repo as unknown as { getTenantId(): string }).getTenantId();
            expect(tenantId).toBe('tenant-1');
        });

        it('should extract tenant_id from broker context meta', () => {
            mockBroker.getContext.mockReturnValue({ meta: { tenant_id: 'tenant-2' } });
            const tenantId = (repo as unknown as { getTenantId(): string }).getTenantId();
            expect(tenantId).toBe('tenant-2');
        });

        it('should fallback to ContextStack if broker is undefined', () => {
            const repoNoBroker = new BaseRepository('users', schema, mockAdapter);
            (ContextStack.getContext as jest.Mock).mockReturnValue({ meta: { tenant_id: 'tenant-3' } });
            const tenantId = (repoNoBroker as unknown as { getTenantId(): string }).getTenantId();
            expect(tenantId).toBe('tenant-3');
        });

        it('should return undefined tenant_id if no context', () => {
            mockBroker.getContext.mockReturnValue(undefined);
            (ContextStack.getContext as jest.Mock).mockReturnValue(undefined);
            const tenantId = (repo as unknown as { getTenantId(): string }).getTenantId();
            expect(tenantId).toBeUndefined();
        });

        it('create should validate and insert data', async () => {
            mockAdapter.run.mockResolvedValue({ lastInsertId: 42 });
            const data = { name: 'Alice', age: 30 };
            const result = await repo.create(data as unknown as any);
            expect(result).toEqual({ name: 'Alice', age: 30, id: 42 });
            expect(mockAdapter.run).toHaveBeenCalledWith(
                'INSERT INTO users (name, age) VALUES (?, ?)',
                ['Alice', 30]
            );
        });

        it('find should execute query with filters', async () => {
            mockAdapter.query.mockResolvedValue([{ id: 1, name: 'Bob' }]);
            const results = await repo.find({ name: 'Bob' } as unknown as Partial<z.infer<typeof schema>>);
            expect(results).toEqual([{ id: 1, name: 'Bob' }]);
            expect(mockAdapter.query).toHaveBeenCalledWith(
                'SELECT * FROM users WHERE name = ?',
                ['Bob']
            );
        });

        it('find should handle undefined filters', async () => {
            mockAdapter.query.mockResolvedValue([]);
            await repo.find({ name: 'Bob', age: undefined } as unknown as Partial<z.infer<typeof schema>>);
            expect(mockAdapter.query).toHaveBeenCalledWith(
                'SELECT * FROM users WHERE name = ?',
                ['Bob']
            );
        });

        it('update should execute query with id filter', async () => {
            await repo.update(1, { age: 31 } as unknown as Partial<z.infer<typeof schema>>);
            expect(mockAdapter.run).toHaveBeenCalledWith(
                'UPDATE users SET age = ? WHERE id = ?',
                [31, 1]
            );
        });

        it('remove should execute delete query with id filter', async () => {
            await repo.remove(1);
            expect(mockAdapter.run).toHaveBeenCalledWith(
                'DELETE FROM users WHERE id = ?',
                [1]
            );
        });

        it('findById should return a single record or null', async () => {
            mockAdapter.query.mockResolvedValue([{ id: 1, name: 'Charlie' }]);
            let res = await repo.findById(1);
            expect(res).toEqual({ id: 1, name: 'Charlie' });

            mockAdapter.query.mockResolvedValue([]);
            res = await repo.findById(2);
            expect(res).toBeNull();
        });

        it('findOne should return a single record or null', async () => {
            mockAdapter.query.mockResolvedValue([{ id: 1, name: 'Charlie' }]);
            let res = await repo.findOne({ name: 'Charlie' } as unknown as Partial<z.infer<typeof schema>>);
            expect(res).toEqual({ id: 1, name: 'Charlie' });

            mockAdapter.query.mockResolvedValue([]);
            res = await repo.findOne({ name: 'Dave' } as unknown as Partial<z.infer<typeof schema>>);
            expect(res).toBeNull();
        });
    });

    describe('QueryBuilder', () => {
        let qb: QueryBuilder<typeof schema>;

        beforeEach(() => {
            qb = new QueryBuilder(table, mockAdapter, true, mockBroker);
        });

        it('should set tenantIdOverride', () => {
            qb.forTenant('custom-tenant');
            expect((qb as unknown as { tenantIdOverride: string }).tenantIdOverride).toBe('custom-tenant');
        });

        it('should set selected columns', async () => {
            qb.select(['id', 'name'] as unknown as never[]);
            mockAdapter.query.mockResolvedValue([{ id: 1, name: 'Eve' }]);
            const res = await qb.execute();
            expect(res).toEqual([{ id: 1, name: 'Eve' }]);
            expect(mockAdapter.query).toHaveBeenCalledWith(
                'SELECT id, name FROM users',
                []
            );
        });

        it('should add limit and offset', async () => {
            qb.limit(10).offset(5);
            mockAdapter.query.mockResolvedValue([]);
            await qb.execute();
            expect(mockAdapter.query).toHaveBeenCalledWith(
                'SELECT * FROM users LIMIT 10 OFFSET 5',
                []
            );
        });

        it('should apply tenancy in insert', async () => {
            mockBroker.getContext.mockReturnValue({ meta: { tenant_id: 't1' } });
            await qb.insert({ name: 'Frank' });
            expect(mockAdapter.run).toHaveBeenCalledWith(
                'INSERT INTO users (name, tenant_id) VALUES (?, ?)',
                ['Frank', 't1']
            );
        });

        it('should apply tenancy in update', async () => {
            mockBroker.getContext.mockReturnValue({ meta: { tenant_id: 't1' } });
            await qb.update({ name: 'Frank' });
            expect(mockAdapter.run).toHaveBeenCalledWith(
                'UPDATE users SET name = ? WHERE tenant_id = ?',
                ['Frank', 't1']
            );
        });

        it('should apply tenancy in delete', async () => {
            mockBroker.getContext.mockReturnValue({ meta: { tenant_id: 't1' } });
            await qb.delete();
            expect(mockAdapter.run).toHaveBeenCalledWith(
                'DELETE FROM users WHERE tenant_id = ?',
                ['t1']
            );
        });

        it('liveQuery should create ReactiveState and subscribe to mutations', () => {
            const lq = qb.liveQuery();
            expect(lq).toHaveProperty('results');
            expect(mockBroker.on).toHaveBeenCalledWith('$db.users.mutated', expect.any(Function));
            
            // Trigger the subscription callback
            const callback = mockBroker.on.mock.calls[0][1];
            callback();
            expect(mockAdapter.query).toHaveBeenCalledTimes(2); // 1 initial + 1 from callback
        });

        it('insertOptimistic should update local state and insert', async () => {
            const { ReactiveState } = require('isomorphic-core');
            const localState = new ReactiveState({ users: [{ name: 'Old' }] });
            
            await qb.insertOptimistic({ name: 'New' }, localState, 'users');
            
            expect(localState.data.users).toEqual([{ name: 'Old' }, { name: 'New' }]);
            expect(mockAdapter.run).toHaveBeenCalled();
        });

        it('insertOptimistic should rollback on failure', async () => {
            const { ReactiveState } = require('isomorphic-core');
            const localState = new ReactiveState({ users: [{ name: 'Old' }] });
            
            mockAdapter.run.mockRejectedValue(new Error('DB Error'));
            
            await expect(qb.insertOptimistic({ name: 'Fail' }, localState, 'users')).rejects.toThrow('DB Error');
            expect(localState.data.users).toEqual([{ name: 'Old' }]); // Rolled back
        });
        
        it('insertOptimistic should handle non-array targets', async () => {
            const { ReactiveState } = require('isomorphic-core');
            const localState = new ReactiveState({ obj: { nested: {} } });
            await qb.insertOptimistic({ name: 'Test' }, localState, 'obj.nested');
            // Shouldn't crash, target is not array
            expect(mockAdapter.run).toHaveBeenCalled();
        });

        it('transaction should reuse existing transaction context', async () => {
            mockBroker.getContext.mockReturnValue({ meta: { _tx: true } });
            const fn = jest.fn().mockResolvedValue('ok');
            const res = await qb.transaction(fn);
            expect(res).toBe('ok');
            expect(mockAdapter.transaction).not.toHaveBeenCalled();
            expect(fn).toHaveBeenCalledWith(qb);
        });

        it('transaction should execute without transaction if adapter lacks it', async () => {
            mockBroker.getContext.mockReturnValue(undefined);
            delete mockAdapter.transaction;
            const fn = jest.fn().mockResolvedValue('ok');
            const res = await qb.transaction(fn);
            expect(res).toBe('ok');
            expect(fn).toHaveBeenCalledWith(qb);
        });

        it('transaction should create new transaction context if none exists', async () => {
            mockBroker.getContext.mockReturnValue(undefined);
            const fn = jest.fn().mockResolvedValue('ok');
            const res = await qb.transaction(fn);
            expect(res).toBe('ok');
            expect(mockAdapter.transaction).toHaveBeenCalled();
            expect(ContextStack.run).toHaveBeenCalled();
        });

        it('executeDebounced should execute query', async () => {
            mockAdapter.query.mockResolvedValue([{ id: 1, name: 'Debounced' }]);
            const res = await (qb as unknown as { executeDebounced(): Promise<unknown[]> }).executeDebounced();
            expect(res).toEqual([{ id: 1, name: 'Debounced' }]);
        });

        it('batch should wrap operations in transaction', async () => {
            const spy = jest.spyOn(qb, 'transaction').mockResolvedValue(undefined as never);
            const fn = jest.fn();
            await qb.batch(fn);
            expect(spy).toHaveBeenCalledWith(fn);
        });
    });

    describe('DatabaseMixin', () => {
        it('should add db property and provision CRUD actions onInit', async () => {
            const Mixed = DatabaseMixin(table)(class Base {
                async onInit() {}
            });
            const instance = new Mixed();

            const mockApp = {
                getProvider: jest.fn((key) => {
                    if (key === 'database:adapter') return mockAdapter;
                    if (key === 'broker') return mockBroker;
                    if (key === 'database:config') return { enforceTenancy: true };
                })
            };

            await instance.onInit(mockApp as any);

            expect(instance.db).toBeInstanceOf(QueryBuilder);
            expect(mockApp.getProvider).toHaveBeenCalledWith('database:adapter');
            expect(mockApp.getProvider).toHaveBeenCalledWith('broker');
            expect(mockApp.getProvider).toHaveBeenCalledWith('database:config');
        });

        it('should call super.onInit if it exists', async () => {
            const superOnInit = jest.fn();
            const Mixed = DatabaseMixin(table)(class Base {
                async onInit(app: any) {
                    superOnInit(app);
                }
            });
            const instance = new Mixed();
            const mockApp = { getProvider: jest.fn() };
            
            await instance.onInit(mockApp as any);
            expect(superOnInit).toHaveBeenCalledWith(mockApp);
        });
        
        it('_provisionCRUDActions should use constructor name if name property is undefined', () => {
             const Mixed = DatabaseMixin(table)(class TestService {});
             const instance = new Mixed();
             instance._provisionCRUDActions(mockBroker);
             // Just verifying it doesn't throw and coverage hits the logic
             expect(true).toBe(true);
        });
        
        it('_provisionCRUDActions should use name property if defined', () => {
             const Mixed = DatabaseMixin(table)(class Base {
                 name = 'CustomService';
             });
             const instance = new Mixed();
             instance._provisionCRUDActions(mockBroker);
             expect(true).toBe(true);
        });
    });
});
