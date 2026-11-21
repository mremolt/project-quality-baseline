// Deliberate violation: a context persistence adapter injects the Kysely instance instead of using the transaction
// adapter's executor(); dependency-cruiser must reject it (NEST-DB-04).
import { KYSELY } from '../../../../../platform/adapter/out/persistence/kysely.token.js';

export const demoToken = KYSELY;
