import { inspect } from 'node:util';

/** Self-masking secret value (CFG-07): never printed, serialized or inspected. */
export class Secret {
  readonly #value: string;
  constructor(value: string) {
    if (value.trim() === '') throw new Error('secret must not be blank');
    this.#value = value;
  }
  reveal(): string {
    return this.#value;
  }
  toString(): string {
    return '***';
  }
  toJSON(): string {
    return '***';
  }
  [inspect.custom](): string {
    return '***';
  }
}
