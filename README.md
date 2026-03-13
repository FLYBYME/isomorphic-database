# isomorphic-database

Type-safe, isomorphic database query builder and CRUD layer for the Mesh ecosystem.

## Features

- **Query Builder**: Fluent interface for building SQL-like queries with type safety.
- **Inference Engine**: Derive TypeScript types directly from Zod schemas.
- **BaseRepository**: Generic CRUD operations (`create`, `find`, `update`, `remove`).
- **Tenant Isolation**: Built-in multi-tenancy enforcement at the repository level.
- **Isomorphic**: Runs in both Node.js and Browser (WASM/IndexedDB) environments.

## Installation

```bash
npm install isomorphic-database
```

## Usage

```typescript
import { z } from 'zod';
import { BaseRepository, defineTable } from 'isomorphic-database';

const TodoSchema = z.object({
    id: z.string(),
    text: z.string(),
    completed: z.boolean()
});

const todoTable = defineTable('todos', TodoSchema);
const repository = new BaseRepository('todos', TodoSchema, adapter, broker);

// Type-safe CRUD
const todos = await repository.find({ completed: false });
```
