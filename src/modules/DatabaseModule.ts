import { IMeshModule, IMeshApp, IServiceBroker } from 'isomorphic-core';
import { IDatabaseAdapter } from '../core/Table';

export interface DatabaseConfig {
    adapter: IDatabaseAdapter;
    enforceTenancy?: boolean;
    schemaVersion?: string;
}

/**
 * DatabaseModule — Connects the database engine to the MeshApp shell.
 */
export class DatabaseModule implements IMeshModule {
    public readonly name = 'database';
    private listeners = new Map<string, Set<() => void>>();
    private isReady = false;
    
    constructor(private config: DatabaseConfig) {}

    async onInit(app: IMeshApp): Promise<void> {
        app.registerProvider('database:adapter', this.config.adapter);
        app.registerProvider('database:config', this.config);
        app.registerProvider('database:module', this);

        // WASM Cold Start Fix: Wait for adapter initialization
        if ((this.config.adapter as any).init) {
            await (this.config.adapter as any).init();
        }
        this.isReady = true;
    }

    onBind(app: IMeshApp): void {
        const broker = app.getProvider<IServiceBroker>('broker');
        const registry = app.getProvider<any>('registry');
        
        // Schema Migration Sync: Check other nodes in the mesh
        registry.on('node:registered', (node: any) => {
            const remoteVersion = node.metadata?.dbSchemaVersion;
            if (remoteVersion && this.config.schemaVersion && remoteVersion !== this.config.schemaVersion) {
                app.logger.error(`[DatabaseModule] Schema version mismatch! Local: ${this.config.schemaVersion}, Remote (${node.nodeID}): ${remoteVersion}. Shutting down node.`);
                app.stop();
            }
        });

        // Add our version to app metadata if not present
        (app.config.metadata as any).dbSchemaVersion = this.config.schemaVersion;

        // Listen for global mutation events to trigger invalidations
        broker.on('$db.*.mutated', (payload: any) => {
            const table = payload.table;
            this.invalidate(table);
        });
    }

    async health(): Promise<boolean> {
        return this.isReady;
    }

    /**
     * Registers a listener (typically a refresh function from liveQuery) for a table.
     */
    public watch(table: string, onMutated: () => void): () => void {
        if (!this.listeners.has(table)) {
            this.listeners.set(table, new Set());
        }
        this.listeners.get(table)!.add(onMutated);
        return () => {
            this.listeners.get(table)?.delete(onMutated);
        };
    }

    /**
     * Triggers all listeners for a given table.
     */
    public invalidate(table: string): void {
        const set = this.listeners.get(table);
        if (set) {
            for (const refresh of set) {
                refresh();
            }
        }
    }

    public get enforceTenancy(): boolean {
        return this.config.enforceTenancy !== false;
    }
}
