/** The authenticated user behind a server-side request, resolved from the session (never from request input). */
export interface Caller {
  readonly subject: string;
}
