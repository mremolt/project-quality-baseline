// Deliberate type-only violation: dependency-cruiser must reject it (NODE-ARCH-14).
import type { DemoRow } from '../adapter/out/persistence/demo-row.js';

export type Demo = DemoRow;
