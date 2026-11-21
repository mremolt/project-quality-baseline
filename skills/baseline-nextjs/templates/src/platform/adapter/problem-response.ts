const TITLES: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/** A problem+json answer with the fixed reason phrase as title, never an exception message (NEST-SEC-30). */
export function problemResponse(status: number): Response {
  return Response.json(
    { type: 'about:blank', title: TITLES[status] ?? 'Error', status },
    { status, headers: { 'content-type': 'application/problem+json', 'cache-control': 'no-store' } },
  );
}
