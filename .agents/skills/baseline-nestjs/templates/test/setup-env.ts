// Test values for required configuration, so modules that load config at import time build in unit tests.
process.env['AUTH_ISSUER'] ??= 'https://idp.test/realms/test';
process.env['AUTH_AUDIENCE'] ??= 'orders-api';
process.env['AUTH_JWKS_URI'] ??= 'https://idp.test/realms/test/certs';
process.env['DATABASE_HOST'] ??= 'localhost';
process.env['DATABASE_NAME'] ??= 'orders';
process.env['DATABASE_USER'] ??= 'orders';
process.env['DATABASE_PASSWORD'] ??= 'test-only';
