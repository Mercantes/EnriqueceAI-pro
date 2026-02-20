/**
 * Enrichment provider abstraction.
 * Supports CNPJ.ws (free, basic data) and Lemit (premium, contact data).
 */

export interface EnrichmentData {
  razao_social?: string;
  nome_fantasia?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
  porte?: string;
  cnae?: string;
  situacao_cadastral?: string;
  email?: string;
  telefone?: string;
  socios?: Array<{
    nome: string;
    qualificacao?: string;
    cpf_masked?: string;
  }>;
  faturamento_estimado?: number;
}

export interface EnrichmentResult {
  success: boolean;
  data?: EnrichmentData;
  error?: string;
}

export interface EnrichmentProvider {
  name: string;
  enrich(cnpj: string): Promise<EnrichmentResult>;
}

/**
 * CNPJ.ws provider — free, basic cadastral data.
 * Rate limit: 3 requests/minute.
 */
export class CnpjWsProvider implements EnrichmentProvider {
  name = 'cnpj_ws';
  private baseUrl: string;

  constructor(baseUrl = 'https://publica.cnpj.ws/cnpj') {
    this.baseUrl = baseUrl;
  }

  async enrich(cnpj: string): Promise<EnrichmentResult> {
    try {
      const response = await fetch(`${this.baseUrl}/${cnpj}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 429) {
        return { success: false, error: 'Rate limit exceeded' };
      }

      if (response.status === 404) {
        return { success: false, error: 'CNPJ not found' };
      }

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const raw = await response.json();
      return {
        success: true,
        data: this.mapResponse(raw),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  private mapResponse(raw: Record<string, unknown>): EnrichmentData {
    const estabelecimento = raw.estabelecimento as Record<string, unknown> | undefined;
    const socios = raw.socios as Array<Record<string, unknown>> | undefined;

    return {
      razao_social: raw.razao_social as string | undefined,
      nome_fantasia: (estabelecimento?.nome_fantasia as string) || undefined,
      endereco: estabelecimento
        ? {
            logradouro: estabelecimento.logradouro as string | undefined,
            numero: estabelecimento.numero as string | undefined,
            complemento: estabelecimento.complemento as string | undefined,
            bairro: estabelecimento.bairro as string | undefined,
            cidade: (estabelecimento.cidade as Record<string, unknown>)?.nome as string | undefined,
            uf: (estabelecimento.estado as Record<string, unknown>)?.sigla as string | undefined,
            cep: estabelecimento.cep as string | undefined,
          }
        : undefined,
      porte: (raw.porte as Record<string, unknown>)?.descricao as string | undefined,
      cnae: (estabelecimento?.atividade_principal as Record<string, unknown>)?.id as string | undefined,
      situacao_cadastral: (estabelecimento?.situacao_cadastral as string) || undefined,
      socios: socios?.map((s) => ({
        nome: s.nome as string,
        qualificacao: (s.qualificacao as Record<string, unknown>)?.descricao as string | undefined,
      })),
    };
  }
}

/**
 * Lemit provider — premium, contact data (emails, phones, revenue).
 * Requires API key.
 */
export class LemitProvider implements EnrichmentProvider {
  name = 'lemit';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.lemit.com.br/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async enrich(cnpj: string): Promise<EnrichmentResult> {
    try {
      const response = await fetch(`${this.baseUrl}/company/${cnpj}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 429) {
        return { success: false, error: 'Rate limit exceeded' };
      }

      if (response.status === 404) {
        return { success: false, error: 'CNPJ not found' };
      }

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const raw = await response.json();
      return {
        success: true,
        data: this.mapResponse(raw),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  private mapResponse(raw: Record<string, unknown>): EnrichmentData {
    return {
      razao_social: raw.razao_social as string | undefined,
      nome_fantasia: raw.nome_fantasia as string | undefined,
      email: raw.email as string | undefined,
      telefone: raw.telefone as string | undefined,
      faturamento_estimado: raw.faturamento_estimado as number | undefined,
      socios: (raw.socios as Array<Record<string, unknown>>)?.map((s) => ({
        nome: s.nome as string,
        qualificacao: s.qualificacao as string | undefined,
        cpf_masked: s.cpf_masked as string | undefined,
      })),
    };
  }
}
