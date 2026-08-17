/**
 * Decodificação de arquivos CSV enviados pelo operador.
 *
 * `file.text()` assume UTF-8 sempre. O Excel brasileiro salva "CSV (separado
 * por vírgulas)" em Windows-1252, então "Construção" chegava como "Constru��o"
 * — e ia direto para o banco, porque nada nesse caminho valida texto.
 *
 * Estratégia: BOM manda (é explícito); sem BOM, tenta UTF-8 em modo estrito e
 * cai para Windows-1252 quando a sequência de bytes é inválida. Todo CSV
 * ASCII puro decodifica igual nos dois, então o fallback só age onde importa:
 * arquivos com acentuação salvos em latin1.
 */

/** Superset do latin1 usado pelo Excel/Windows em pt-BR. */
const LEGACY_ENCODING = 'windows-1252';

export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // BOM UTF-16: o TextDecoder consome o BOM sozinho.
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer);
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer);
  }

  // BOM UTF-8 → confia e decodifica; o TextDecoder consome o BOM.
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer);
  }

  try {
    // `fatal` faz o decoder lançar em byte inválido em vez de emitir U+FFFD —
    // é exatamente o sinal de que o arquivo não é UTF-8.
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder(LEGACY_ENCODING).decode(buffer);
  }
}

export async function decodeCsvFile(file: Blob): Promise<string> {
  return decodeCsvBuffer(await file.arrayBuffer());
}
