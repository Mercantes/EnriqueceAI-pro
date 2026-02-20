/**
 * CNPJ validation and formatting utilities.
 * CNPJ = Cadastro Nacional da Pessoa Jurídica (14-digit Brazilian company ID).
 */

const CNPJ_LENGTH = 14;
const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Strips non-digit characters from a CNPJ string.
 */
export function stripCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

/**
 * Formats a 14-digit CNPJ string as XX.XXX.XXX/XXXX-XX.
 */
export function formatCnpj(cnpj: string): string {
  const digits = stripCnpj(cnpj);
  if (digits.length !== CNPJ_LENGTH) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/**
 * Validates a CNPJ string using check digit algorithm.
 * Accepts both formatted (XX.XXX.XXX/XXXX-XX) and raw (14 digits) formats.
 */
export function isValidCnpj(cnpj: string): boolean {
  const digits = stripCnpj(cnpj);

  if (digits.length !== CNPJ_LENGTH) return false;

  // Reject all-same-digit CNPJs (e.g., 00000000000000)
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits.charAt(i)) * CNPJ_WEIGHTS_1[i]!;
  }
  let remainder = sum % 11;
  const checkDigit1 = remainder < 2 ? 0 : 11 - remainder;
  if (Number(digits.charAt(12)) !== checkDigit1) return false;

  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(digits.charAt(i)) * CNPJ_WEIGHTS_2[i]!;
  }
  remainder = sum % 11;
  const checkDigit2 = remainder < 2 ? 0 : 11 - remainder;
  if (Number(digits.charAt(13)) !== checkDigit2) return false;

  return true;
}
