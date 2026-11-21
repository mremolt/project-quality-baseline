import { defineConfig } from 'orval';

const spec = './openapi/orders-v1.yaml'; // product repo: '../backend/openapi/orders-v1.yaml' (TS-API-01)
const generated = './src/features/orders/adapter/out/http/generated';
const http = './src/platform/adapter/out/http';

// One plain fetch client per side (TS-API-03): the same operations, bound to the browser or the server mutator.
const fetchClient = (side: 'browser' | 'server', mutator: string, mock: boolean) => ({
  input: { target: spec },
  output: {
    mode: 'tags-split' as const,
    client: 'fetch' as const,
    target: `${generated}/${side}`,
    schemas: `${generated}/model`,
    override: {
      mutator: { path: `${http}/${mutator}`, name: 'customFetch' },
      fetch: { includeHttpResponseReturnType: false },
    },
    urlEncodeParameters: true, // TS-API-09, REACT-API-03
    ...(mock ? { mock: { generators: [{ type: 'msw' as const, useExamples: true }] } } : {}),
    clean: [`${generated}/${side}`], // never clean the shared model/ folder from one output (NEXT-API-01)
  },
});

export default defineConfig({
  ordersBrowser: fetchClient('browser', 'browser-fetch.ts', true),
  ordersServer: fetchClient('server', 'server-fetch.ts', false),
  ordersZod: {
    input: { target: spec },
    output: {
      mode: 'tags-split',
      client: 'zod',
      target: `${generated}/zod`,
      fileExtension: '.zod.ts',
      clean: [`${generated}/zod`],
    },
  },
});
