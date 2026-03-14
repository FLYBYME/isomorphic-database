import { SQLiteAdapter } from '../adapters/SQLiteAdapter';
import { MockDatabaseAdapter } from '../adapters/MockDatabaseAdapter';

describe('Database Adapters', () => {
    test('SQLiteAdapter placeholder should initialize', async () => {
        const adapter = new SQLiteAdapter('test.db');
        expect(adapter.name).toBe('native-sqlite');
        
        const results = await adapter.query('SELECT 1', []);
        expect(results).toEqual([]);
        
        const runRes = await adapter.run('INSERT INTO users...', []);
        expect(runRes.changes).toBe(0);
    });

    test('MockDatabaseAdapter should record queries', async () => {
        const adapter = new MockDatabaseAdapter();
        adapter.results = [{ id: 1, name: 'Alice' }];
        
        const results = await adapter.query('SELECT * FROM users', [1]);
        expect(results).toEqual([{ id: 1, name: 'Alice' }]);
        expect(adapter.queries[0]).toEqual({ sql: 'SELECT * FROM users', params: [1] });
    });
});
