/**
 * Neutralize CSV formula injection. A cell whose first character is one of
 * = + - @ (or a leading tab/CR that spreadsheets strip before parsing) is
 * treated as a formula by Excel/Sheets/LibreOffice. Prefixing with a single
 * quote forces the value to be read as text. This is the OWASP-recommended
 * defense for exported CSVs that contain attacker-controllable content
 * (e.g. lead names imported from CSV/API).
 */
export function neutralizeCsvFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * Escape a CSV field value: neutralize formula injection, then wrap in quotes
 * if it contains commas, quotes, or newlines (RFC 4180).
 */
export function escapeCsvField(value: string | number): string {
  const str = neutralizeCsvFormula(String(value));
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
