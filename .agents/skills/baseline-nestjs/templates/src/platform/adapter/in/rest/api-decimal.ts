import { z } from 'zod';

/** Decimals travel as strings (API-REST-01). */
export const ApiDecimal = z
  .string()
  .regex(/^-?\d{1,20}(\.\d{1,10})?$/)
  .meta({ id: 'Decimal', format: 'decimal', example: '12.50' });
