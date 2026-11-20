/** The authenticated principal, framework-free (ARCH-UC-15, NEST-SEC-02). Built by the auth guard, passed into commands. */
export interface Caller {
  readonly id: string;
  readonly roles: readonly string[];
  readonly tenantId?: string;
}

export const hasRole = (caller: Caller, role: string): boolean => caller.roles.includes(role);

/** Caller for messaging consumers and scheduled jobs; the use case authorizes it like any other caller. */
export const systemCaller = (component: string): Caller => ({ id: `system:${component}`, roles: ['system'] });
