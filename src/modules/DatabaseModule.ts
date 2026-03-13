import { IMeshModule, IMeshApp } from 'isomorphic-core';
import { IDatabaseAdapter } from '../core/Table';

export interface DatabaseConfig {
    adapter: IDatabaseAdapter;
    enforceTenancy?: boolean;
}

/**
 * DatabaseModule — Connects the database engine to the MeshApp shell.
 */
export class DatabaseModule implements IMeshModule {
    public readonly name = 'database';
    
    constructor(private config: DatabaseConfig) {}

    onInit(app: IMeshApp): void {
        app.registerProvider('database:adapter', this.config.adapter);
        app.registerProvider('database:config', this.config);
    }

    /**
     * Helper to check if tenancy should be enforced.
     */
    public get enforceTenancy(): boolean {
        return this.config.enforceTenancy !== false; // Default to true
    }
}
