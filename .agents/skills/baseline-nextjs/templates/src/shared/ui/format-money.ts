/** Formats an exact decimal string without converting it to a binary number (Intl accepts numeric strings). */
export function formatMoney(locale: string, money: { readonly amount: string; readonly currency: string }): string {
  // `as` because the compiler cannot know that the API's decimal pattern produces a numeric literal string
  return new Intl.NumberFormat(locale, { style: 'currency', currency: money.currency }).format(
    money.amount as Intl.StringNumericLiteral,
  );
}
