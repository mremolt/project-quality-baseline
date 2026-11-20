const QUERY_OR_FRAGMENT = /(https?:\/\/[^\s?#]+)[?#]\S*/g;
const TOKEN = /\b[\w-]{20,}(?:\.[\w-]+)*/g;

/** Word-wise instead of an e-mail regex: linear time on any input. */
function withoutEmailAddresses(text: string): string {
  return text
    .split(/(\s+)/)
    .map((word) => (word.includes('@') ? '[email]' : word))
    .join('');
}

/** Removes data that must never reach an error report (REACT-OBS-05, TS-SEC-06). */
export function scrub(text: string): string {
  return withoutEmailAddresses(text.replace(QUERY_OR_FRAGMENT, '$1')).replace(TOKEN, '[token]');
}
