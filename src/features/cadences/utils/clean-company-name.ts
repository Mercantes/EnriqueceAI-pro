/**
 * Strips common Brazilian corporate suffixes (LTDA, S.A., ME, EIRELI, EPP, etc.)
 * and returns at most the first two words of the company name.
 *
 * Examples:
 *   "ACME TECNOLOGIA LTDA"         → "Acme Tecnologia"
 *   "EMPRESA GRANDE S.A."          → "Empresa Grande"
 *   "JOAO SILVA ME"                → "Joao Silva"
 *   "RESTAURANTE BOM SABOR EIRELI" → "Restaurante Bom"
 */
export function cleanCompanyName(name: string | null | undefined): string | null {
  if (!name) return null;

  // Remove common corporate suffixes (case-insensitive)
  const suffixes =
    /\b(LTDA\.?|S[\./]?A\.?|ME|MEI|EIRELI|EPP|S[\./]?S\.?|SOCIEDADE\s+LIMITADA|SOCIEDADE\s+AN[OÔ]NIMA|EMPRESA\s+INDIVIDUAL)\b/gi;

  let cleaned = name.replace(suffixes, '').trim();

  // Remove trailing punctuation and extra whitespace
  cleaned = cleaned.replace(/[\s,.\-/]+$/, '').replace(/\s{2,}/g, ' ').trim();

  if (!cleaned) return null;

  // Take at most first 2 words
  const words = cleaned.split(/\s+/).slice(0, 2);

  // Title case each word
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
