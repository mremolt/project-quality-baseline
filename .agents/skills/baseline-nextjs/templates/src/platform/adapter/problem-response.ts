const TITLES: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  413: 'Content Too Large',
  415: 'Unsupported Media Type',
  429: 'Too Many Requests',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/** problem+json with the fixed reason phrase as title, never an exception message (API-REST-05, NEXT-I18N-09). */
export function problemResponse(status: number, headers: Readonly<Record<string, string>> = {}): Response {
  return Response.json(
    { type: 'about:blank', title: TITLES[status] ?? 'Error', status },
    { status, headers: { 'content-type': 'application/problem+json', 'cache-control': 'no-store', ...headers } },
  );
}
