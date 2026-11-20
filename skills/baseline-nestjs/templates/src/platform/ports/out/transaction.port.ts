/** The use case owns the transaction (ARCH-UC-11, NEST-ARCH-08). No remote call inside `work` (RES-TX-01). */
export interface TransactionPort {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
