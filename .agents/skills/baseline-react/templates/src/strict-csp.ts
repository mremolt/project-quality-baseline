import { z } from 'zod';

// zod 4 probes `new Function('')` to decide on its JIT; without 'unsafe-eval' (and with Trusted Types) the probe is
// reported as a CSP violation although zod catches it. Imported first by main.tsx, before any schema parses.
z.config({ jitless: true });
