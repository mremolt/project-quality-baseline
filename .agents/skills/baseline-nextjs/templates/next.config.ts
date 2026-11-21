// NEXT-TOOL-01: exactly these options; deploymentId for version skew (NEXT-REL-17)
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/platform/adapter/in/i18n/request.ts');

// The commit is the only build constant (NEXT-CFG-08): `--build-arg GIT_COMMIT=<sha>` in CI, unset locally
const commit = process.env['GIT_COMMIT'];

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  poweredByHeader: false,
  images: { unoptimized: true }, // no image optimizer: read-only root filesystem (REL-RUN-02)
  agentRules: false, // the baseline's AGENTS.md routes agents (NEXT-TOOL-10)
  turbopack: { root: import.meta.dirname }, // never a lockfile in a parent folder: server.js stays at .next/standalone/
  ...(commit ? { deploymentId: commit } : {}),
  experimental: {
    serverActions: { bodySizeLimit: '100kb' }, // allowedOrigins stays unset (NEXT-SEC-05)
  },
};

export default withNextIntl(nextConfig);
