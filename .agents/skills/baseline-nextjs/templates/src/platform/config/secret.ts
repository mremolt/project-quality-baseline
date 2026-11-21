const MASK = '[secret]';

/** Holds a secret value that never prints (CFG-07); read it only through `reveal()`. */
export class Secret {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return MASK;
  }

  toJSON(): string {
    return MASK;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return MASK;
  }
}
