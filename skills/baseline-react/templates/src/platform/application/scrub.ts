const QUERY_OR_FRAGMENT = /(https?:\/\/[^\s?#]+)[?#]\S*/g;
const TOKEN = /\b[\w-]{20,}(?:\.[\w-]+)*/g;
/** Numeric and UUID path segments: ids, which may identify a person (REACT-OBS-05). Two patterns keep each simple. */
const NUMERIC_SEGMENT = /(?<=\/)\d+(?=[/?#\s]|$)/g;
const UUID_SEGMENT = /(?<=\/)[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}(?=[/?#\s]|$)/gi;

/** Word-wise instead of an e-mail regex: linear time on any input. */
function withoutEmailAddresses(text: string): string {
  return text
    .split(/(\s+)/)
    .map((word) => (word.includes('@') ? '[email]' : word))
    .join('');
}

/** Removes data that must never reach an error report (REACT-OBS-05, TS-SEC-06). */
export function scrub(text: string): string {
  const withoutUrlDetails = text
    .replace(QUERY_OR_FRAGMENT, '$1')
    .replace(NUMERIC_SEGMENT, ':id')
    .replace(UUID_SEGMENT, ':id');
  return withoutEmailAddresses(withoutUrlDetails).replace(TOKEN, '[token]');
}
