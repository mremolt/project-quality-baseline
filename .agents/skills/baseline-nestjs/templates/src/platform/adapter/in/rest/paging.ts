import { z } from 'zod';

/** A query parameter that may repeat: one value arrives as string, several as array. */
export const repeatable = <T extends z.ZodType>(item: T): z.ZodType<z.output<T>[] | undefined> =>
  z.preprocess((v) => (v === undefined || Array.isArray(v) ? v : [v]), z.array(item).optional());

export const pageOf = <T extends z.ZodType>(
  item: T,
): z.ZodObject<{ items: z.ZodArray<T>; page: z.ZodInt; size: z.ZodInt; totalElements: z.ZodInt }> =>
  z.object({ items: z.array(item), page: z.int().min(0), size: z.int().min(1), totalElements: z.int().min(0) });
