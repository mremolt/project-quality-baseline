import type { ConfigSchema } from './platform/config/load-config.js';
import { AuthConfig, DatabaseConfig, HttpConfig, LoggingConfig } from './platform/config/platform.config.js';

/** Every config schema of the component; the key list test compares them with configuration-keys.yaml (CFG-12). */
export const configSchemas: readonly ConfigSchema[] = [HttpConfig, LoggingConfig, AuthConfig, DatabaseConfig];
