/** Formats a decimal string exactly (no float conversion, API-REST-01); `Intl.NumberFormat` accepts numeric strings since ES2023. */
export function formatMoney(locale: string, money: { readonly amount: string; readonly currency: string }): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: money.currency }).format(
    money.amount as Intl.StringNumericLiteral,
  );
}
