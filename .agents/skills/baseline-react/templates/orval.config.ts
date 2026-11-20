import { defineConfig } from 'orval';

const input = { target: './openapi/orders-v1.yaml' };
const generated = './src/features/orders/adapter/out/http/generated';

export default defineConfig({
  orders: {
    input,
    output: {
      mode: 'tags-split',
      target: `${generated}/endpoints`,
      schemas: `${generated}/model`,
      client: 'fetch', // plain functions; every call passes the platform mutator (TS-API-03)
      override: {
        mutator: { path: './src/platform/adapter/out/http/custom-fetch.ts', name: 'customFetch' },
        fetch: { includeHttpResponseReturnType: false }, // the mutator returns the body; the adapter zod-parses it
      },
      mock: { generators: [{ type: 'msw', useExamples: true }] },
      urlEncodeParameters: true, // path parameters are encodeURIComponent-ed
      clean: true,
    },
  },
  ordersZod: {
    input,
    output: {
      mode: 'tags-split',
      target: `${generated}/endpoints`,
      client: 'zod',
      fileExtension: '.zod.ts',
    },
  },
});
