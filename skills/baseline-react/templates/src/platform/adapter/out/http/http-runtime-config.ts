import { z } from 'zod';

import type { RuntimeConfig } from '../../../domain';
import type { LoadRuntimeConfigPort } from '../../../ports/out/runtime-config.port';

const SameOriginPath = z
  .string()
  .startsWith('/')
  .refine((path) => !path.startsWith('//'), 'same-origin path');

/** The list of what may be in `/config.json`; a new field is reviewed like an API change (REACT-CFG-03/05). */
export const RuntimeConfigSchema = z.object({
  environment: z.string().min(1),
  release: z.string().min(1), // REL-VER-05, in error reports (REACT-OBS-05)
  requestTimeoutMs: z.int().positive(),
  loginPath: SameOriginPath,
  errorReporting: z.object({ enabled: z.boolean(), path: SameOriginPath }),
}) satisfies z.ZodType<RuntimeConfig>;

/** Loads the per-environment values before the first render; plain fetch, because the HTTP stack needs them (CFG-02). */
export class HttpRuntimeConfig implements LoadRuntimeConfigPort {
  async loadRuntimeConfig(): Promise<Readonly<RuntimeConfig>> {
    const response = await fetch('/config.json', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`config.json: HTTP ${String(response.status)}`);
    return Object.freeze(RuntimeConfigSchema.parse(await response.json()));
  }
}
