const LOCALE = "en-US";

/**
 * Formats a calendar date without allowing the server or browser timezone to
 * move it to an adjacent day. An explicit locale keeps hydration deterministic.
 */
export function formatDateKey(dateKey: string, options: Intl.DateTimeFormatOptions) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" }).format(date);
}

/**
 * Formats an instant in the user's saved timezone with an explicit locale.
 * This produces identical server and browser markup during hydration.
 */
export function formatTimestamp(
  value: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
) {
  const date = new Date(value);
  try {
    return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" }).format(date);
  }
}
