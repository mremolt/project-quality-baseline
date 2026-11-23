import { Injectable } from '@angular/core';
import type { TranslocoTranspiler, TranspileParams } from '@jsverse/transloco';
import { IntlMessageFormat } from 'intl-messageformat';

/**
 * ICU MessageFormat for the translation catalogs (NG-I18N-01/06: plural, select) without `eval`. The
 * `@jsverse/transloco-messageformat` plugin compiles messages with `new Function`, which the CSP and Trusted Types of
 * NG-SEC-05 forbid; `intl-messageformat` parses the message and interprets it instead.
 * Register once in app.config.ts: `provideTranslocoTranspiler(IcuTranspiler)`; export it from `src/platform/index.ts`.
 */
@Injectable()
export class IcuTranspiler implements TranslocoTranspiler {
  private lang = 'en';
  private readonly cache = new Map<string, IntlMessageFormat>();

  onLangChanged(lang: string): void {
    this.lang = lang;
  }

  transpile({ value, params, translation, key }: TranspileParams): unknown {
    if (typeof value === 'string') {
      return this.format(value, params);
    }
    if (Array.isArray(value)) {
      return value.map((item: unknown) =>
        this.transpile(params ? { value: item, params, translation, key } : { value: item, translation, key }),
      );
    }
    return value;
  }

  private format(message: string, params: Record<string, unknown> | undefined): string {
    if (!message.includes('{')) {
      return message;
    }
    const cacheKey = `${this.lang}|${message}`;
    let compiled = this.cache.get(cacheKey);
    if (!compiled) {
      compiled = new IntlMessageFormat(message, this.lang);
      this.cache.set(cacheKey, compiled);
    }
    const result = compiled.format(params ?? {});
    return Array.isArray(result) ? result.map(String).join('') : String(result);
  }
}
