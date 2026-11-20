# @ngrx/signals — Entity Management

Use `@ngrx/signals/entities` whenever the data is a collection of items with a stable `id` (NG-STATE-06). It gives you normalized storage (`entityMap` + `ids`) and a complete set of immutable updaters. Entities are **domain values or use-case results**, never backend DTOs (NG-STATE-04).

## Setup

```typescript
import { signalStore } from '@ngrx/signals';
import { withEntities } from '@ngrx/signals/entities';

interface Todo {
  readonly id: number;
  readonly text: string;
  readonly completed: boolean;
}

export const TodosStore = signalStore(withEntities<Todo>());
```

Default contract: each entity needs an `id: string | number` (an `EntityId`). Branded domain IDs (`type OrderId = string & { readonly __brand: 'OrderId' }`) satisfy it. For domain types whose identifier has another name, use a `selectId` function (see [Custom id](#custom-id-selectid)).

What you get on the store:

| Signal      | Type                      | Notes                                 |
| ----------- | ------------------------- | ------------------------------------- |
| `ids`       | `Signal<EntityId[]>`      | Insertion order is preserved.         |
| `entityMap` | `Signal<EntityMap<Todo>>` | Keyed map.                            |
| `entities`  | `Signal<Todo[]>`          | Computed, derived from `ids` + `map`. |

`ids` and `entityMap` are state slices (mutable via `patchState`). `entities` is a computed.

## Standalone updaters

Always combine with `patchState`. All updaters are immutable.

### Add

```typescript
patchState(store, addEntity(todo));
patchState(store, addEntities([todo1, todo2]));
patchState(store, prependEntity(todo)); // pushes to start
patchState(store, prependEntities([t1, t2]));
```

`addEntity` is a no-op if the ID already exists (no error, no override).

Passing an inline object literal infers a narrower entity type (`completed: false`, a template-literal `id` from `crypto.randomUUID()`) and `patchState` fails to compile. Pass a typed value or the type argument: `addEntity<Todo>({ id: crypto.randomUUID(), text, completed: false })`. Same for `setEntity`/`upsertEntity`/`prependEntity`. In our code, new domain values usually come from a domain factory or a use-case result, which already carries the right type.

### Set / replace

```typescript
patchState(store, setEntity(todo)); // add or replace one
patchState(store, setEntities([t1, t2])); // add or replace many
patchState(store, setAllEntities(newList)); // replace the whole collection
```

Use `setAllEntities` after a use case returned a fresh list. The collection updaters take mutable arrays, while our use-case contracts return `Promise<readonly Order[]>` (immutable results, TS-ARCH-01). Spread when patching: `setAllEntities([...orders])`.

### Update

```typescript
patchState(store, updateEntity({ id: 1, changes: { completed: true } }));

patchState(
  store,
  updateEntity({
    id: 1,
    changes: (todo) => ({ completed: !todo.completed }),
  }),
);

patchState(
  store,
  updateEntities({
    ids: [1, 2],
    changes: { completed: true },
  }),
);

patchState(
  store,
  updateEntities({
    predicate: ({ text }) => text.endsWith('✅'),
    changes: { text: '' },
  }),
);

patchState(store, updateAllEntities({ completed: false }));
```

`updateEntity` / `updateEntities` are no-ops for missing IDs — no error.

Function-form `changes` can be a pure domain function (`changes: markCancelled` where `markCancelled(order: Order): Partial<Order>` lives in `domain`), which keeps the rule out of the store (NG-STATE-07).

### Upsert

Merges with existing or inserts. Properties not present in the patch are preserved.

```typescript
patchState(store, upsertEntity(todo));
patchState(store, upsertEntities([t1, t2]));
```

### Remove

```typescript
patchState(store, removeEntity(1));
patchState(store, removeEntities([1, 2]));
patchState(store, removeEntities((todo) => todo.completed));
patchState(store, removeAllEntities());
```

## Custom id (`selectId`)

If your entity uses something other than `id`, declare a `selectId` function with `entityConfig` and pass the same config to `withEntities` and to every updater that needs the id (add/set/upsert/prepend/update):

```typescript
import { patchState, signalStore, type, withMethods } from '@ngrx/signals';
import { addEntity, entityConfig, withEntities } from '@ngrx/signals/entities';

interface User {
  readonly uuid: string;
  readonly name: string;
}

const userConfig = entityConfig({
  entity: type<User>(),
  selectId: (user) => user.uuid,
});

export const UsersStore = signalStore(
  withEntities(userConfig),
  withMethods((store) => ({
    addUser(user: User): void {
      patchState(store, addEntity(user, userConfig));
    },
  })),
);
```

`entityConfig` can also carry `collection`, so one constant covers both options. (There is no `idKey` option — that was an old API.)

## Named collections (multiple entities in one store)

When one store holds two or more entity types, name each collection. The collection name shows up in the signal names and is required on every updater call.

```typescript
import { patchState, signalStore, type, withMethods } from '@ngrx/signals';
import { addEntity, removeEntity, withEntities } from '@ngrx/signals/entities';

interface Book {
  readonly id: string;
  readonly title: string;
}
interface Author {
  readonly id: string;
  readonly name: string;
}

export const LibraryStore = signalStore(
  withEntities({ entity: type<Book>(), collection: 'book' }),
  withEntities({ entity: type<Author>(), collection: 'author' }),
  withMethods((store) => ({
    addBook(book: Book): void {
      patchState(store, addEntity(book, { collection: 'book' }));
    },
    addAuthor(author: Author): void {
      patchState(store, addEntity(author, { collection: 'author' }));
    },
    removeBook(id: string): void {
      patchState(store, removeEntity(id, { collection: 'book' }));
    },
  })),
);

// Signals:
//   store.bookIds(), store.bookEntityMap(), store.bookEntities()
//   store.authorIds(), store.authorEntityMap(), store.authorEntities()
```

Always pass the `collection` option on every updater — forgetting it targets the unnamed `entityMap`/`ids` slices, which a named-only store doesn't have, so `patchState` fails to compile.

## Loading a list through a use case

Combine entities + request status (see `custom-features.md`). The store calls the use-case contract injected through its token (NG-STATE-02), never an API service:

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods } from '@ngrx/signals';
import { setAllEntities, withEntities } from '@ngrx/signals/entities';

import { setError, setFulfilled, setPending, withRequestStatus } from '../../../../../platform'; // index.ts only (NG-ARCH-04)
import type { CustomerId, Order } from '../../../domain/order';
import { LOAD_ORDER_HISTORY } from '../../../orders.tokens';
import { LoadOrderHistoryQuery } from '../../../ports/in/load-order-history-query';
import { OrdersErrorKeys } from './orders-error-keys';

export const OrdersStore = signalStore(
  withEntities<Order>(),
  withRequestStatus(),
  withMethods((store, loadHistory = inject(LOAD_ORDER_HISTORY), errors = inject(OrdersErrorKeys)) => ({
    async load(customerId: CustomerId): Promise<void> {
      patchState(store, setPending());
      try {
        const orders = await loadHistory.loadOrderHistory(LoadOrderHistoryQuery.of({ customerId }));
        patchState(store, setAllEntities([...orders]), setFulfilled());
      } catch (error) {
        patchState(store, setError(errors.keyFor(error)));
      }
    },
  })),
);
```

Two updaters in one `patchState` call is the idiomatic shape for "set data + flip status."
