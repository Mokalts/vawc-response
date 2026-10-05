/**
 * Reading the API's timestamps in the right timezone.
 *
 * The backend stores and returns UTC, but serialises it without a zone marker:
 * "2026-10-05T06:30:00". Given a string like that, the browser assumes LOCAL
 * time, so every timestamp in both portals rendered eight hours early here.
 * A report filed at 1am showed as 5pm the previous day, which put it on the
 * wrong date in the case list and in the monthly figures.
 *
 * Appending the marker tells the browser what the value actually is, and it
 * then converts to the reader's own zone correctly.
 *
 * Anything that already carries a zone, or is already a Date, is left alone.
 */
export function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const s = String(value);
    const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s);
    // Date-only values ("2026-10-05") have no time to shift, and marking them
    // UTC would move them a day for anyone behind the line.
    const hasTime = s.includes('T') || s.includes(' ');
    return new Date(hasZone || !hasTime ? s : s + 'Z');
}
