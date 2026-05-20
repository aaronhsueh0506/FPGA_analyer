/** Parse a datetime string from the backend as UTC, display in local timezone. */
export function parseUTCDate(s: string): Date {
  if (!s) return new Date(NaN)
  // If no timezone suffix, the backend stored UTC without marker — append Z
  if (!s.endsWith('Z') && !s.includes('+') && !s.match(/-\d{2}:\d{2}$/)) {
    return new Date(s + 'Z')
  }
  return new Date(s)
}

export function formatLocalDate(s: string): string {
  return parseUTCDate(s).toLocaleString()
}
