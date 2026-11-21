import type { RuntimeConfig } from '../../domain';

export interface LoadRuntimeConfigPort {
  loadRuntimeConfig(): Promise<Readonly<RuntimeConfig>>;
}
