import { z } from 'zod';
import { QueryBuilder } from './QueryBuilder';
import { TableDefinition, IDatabaseAdapter } from './Table';
import { IMeshApp, IServiceBroker } from 'isomorphic-core';

/**
 * DatabaseMixin — Auto-provisions 'this.db' and CRUD actions for services.
 */
export function DatabaseMixin<T extends z.ZodObject<any>>(table: TableDefinition<T>) {
    return (Base: any) => {
        return class extends Base {
            public db!: QueryBuilder<T>;
            public _table = table;

            async onInit(app: IMeshApp): Promise<void> {
                if (super.onInit) await super.onInit(app);

                const adapter = app.getProvider<IDatabaseAdapter>('database:adapter');
                const broker = app.getProvider<IServiceBroker>('broker');
                const config = app.getProvider<any>('database:config');
                
                this.db = new QueryBuilder(
                    this._table, 
                    adapter, 
                    config?.enforceTenancy !== false,
                    broker
                );

                this._provisionCRUDActions(broker);
            }

            public _provisionCRUDActions(broker: IServiceBroker): void {
                const serviceName = this.name || this.constructor.name.replace('Service', '').toLowerCase();
                
                // Note: CRUD actions should ideally be registered in the service's contract.
                // This logic is a placeholder for automatic mapping.
            }
        };
    };
}
