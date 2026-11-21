// Test helper standing in for the BFF (REACT-SEC-09, REACT-TEST-18): serves dist/, templates a fresh nonce into index.html
// and sends the strict CSP with Trusted Types. Started by playwright.config.ts; run with plain `node` (type stripping).
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = join(import.meta.dirname, '..', 'dist');
const PORT = Number(process.env['PORT'] ?? '4173');
const NONCE_PLACEHOLDER = 'CSP_NONCE_PLACEHOLDER'; // vite.config.ts html.cspNonce
const TYPES: Readonly<Record<string, string>> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "connect-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "require-trusted-types-for 'script'",
    "trusted-types 'none'",
  ].join('; ');
}

const indexHtml = await readFile(join(DIST, 'index.html'), 'utf8');

createServer((request, response) => {
  const path = normalize(new URL(request.url ?? '/', 'http://localhost').pathname);
  if (path.startsWith('/assets/')) {
    readFile(join(DIST, path))
      .then((body) => {
        response.writeHead(200, {
          'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(body);
      })
      .catch(() => {
        response.writeHead(404).end(); // never index.html for a missing chunk (REL-FE-03)
      });
    return;
  }
  const nonce = randomBytes(16).toString('base64');
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': contentSecurityPolicy(nonce),
    'Cache-Control': 'no-store', // a cached copy would carry a stale nonce
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(indexHtml.replaceAll(NONCE_PLACEHOLDER, nonce));
}).listen(PORT);
