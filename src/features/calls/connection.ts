// Fonte única de verdade para "ligação conectada" e "ligação significativa".
// Módulo PURO — usado por Painel de Ligações, Estatísticas e Extrato, que até
// jul/2026 tinham TRÊS definições diferentes e mostravam taxas incompatíveis:
//
//   Painel de Ligações   duration >= 50s              →  9,8%   (90 dias)
//   Estatísticas/Extrato status IN (significant,       → 68,2%
//                        not_significant)
//   BI do Sales Hub      status='significant'          → 19,4%
//                        OR duration >= 30s
//
// POR QUE `not_significant` NÃO É SINAL DE CONEXÃO
//
// Intuitivamente `not_significant` ("atendeu, sem avanço") parece conectada,
// mas os dados de produção provam o contrário: em 90 dias, 6.221 linhas
// `not_significant` têm `answered_at IS NULL` (ZERO exceções) e carregam
// hangup_cause que provam que ninguém atendeu — NUMBER_CHANGED (2.834),
// ORIGINATOR_CANCEL (2.823, o SDR desistiu antes de tocar), UNALLOCATED_NUMBER,
// CALL_REJECTED. A mediana de duração do bucket é 2 SEGUNDOS e 5.716 têm
// duração zero.
//
// Isso vem de um bug de escrita no pipeline API4COM (o reconcile corrige
// `hangup_cause` depois, mas a guarda `status === 'not_connected'` impede a
// reclassificação, então a linha fica com a causa nova e o status antigo).
// Enquanto esse bug existir, `status` sozinho não é confiável — por isso a
// regra abaixo se apoia em sinais que NÃO são reescritos: `answered_at`
// (o webhook viu channel-answer) e a duração real.
//
// `sdr_outcome` é deliberadamente ignorado aqui: é a leitura do SDR, não a
// medição da telefonia. Misturar os dois foi a origem da divergência de BI de
// mai/2026 — ver `classify-webphone-call.ts`.
import type { CallDisposition, CallStatus } from './types';

/**
 * Piso de duração que, sozinho, comprova conexão. Igual ao usado pelo
 * warehouse do Sales Hub (`status='significant' OR duration_seconds>=30`),
 * para que o número do app e o do BI partam da mesma base.
 */
export const CONNECTED_MIN_DURATION_SECONDS = 30;

export interface CallConnectionSignals {
  status: CallStatus;
  duration_seconds: number;
  /** Timestamp de channel-answer do webhook. Sinal autoritativo de atendimento. */
  answered_at?: string | null;
  /**
   * Desfecho informado pelo SDR (`calls.sdr_disposition`). Só `voicemail` importa
   * aqui: caixa postal/secretária eletrônica ATENDE a linha (a máquina "pega",
   * então `answered_at` vem preenchido), mas não houve contato humano. É o
   * falso-positivo que sobra no lado "answered" — o SDR confirma e a gente exclui.
   */
  sdr_disposition?: CallDisposition | null;
}

/**
 * A ligação alcançou a pessoa do outro lado — regra "answered-first".
 *
 * ORDEM DE PRECEDÊNCIA (a fonte de verdade vem primeiro):
 *  1. `answered_at` — o provedor confirmou channel-answer. Sinal FORTE e direto;
 *     é o que o BI do Sales Hub adotou como fonte de verdade de "atendida".
 *     Cobre 100% das conexões nos ramais com webhook saudável (jul/2026:
 *     `answered_at` explica ~99,7% das conectadas; ver PR).
 *  2. `significant` — salvaguarda qualitativa. Só ADICIONA linhas que não têm
 *     `answered_at` (REST/legado); mantida para garantir a invariante
 *     `significant ⊆ conectadas`. NÃO é atingida pelo bug de escrita — esse bug
 *     produz `not_significant` em não-atendimentos, nunca `significant`.
 *  3. duração >= 30s — proxy para ramais SEM webhook (ex. 1042), cujo
 *     `answered_at` nunca chega mas cuja duração real prova a conversa
 *     (685 ligações de ~61s/mês só nesse ramal, jul/2026). É a rede que impede
 *     um ramal sem webhook de aparecer com 0% de conexão apesar de conversar.
 *
 * `not_significant` continua deliberadamente FORA: de não-atendimento tem
 * `answered_at` nulo e duração ~0, então nunca dispara nenhum dos três sinais.
 *
 * NOTA: os sinais 2 e 3 são salvaguardas para dados sem `answered_at`. Quando o
 * webhook cobrir todos os ramais (resolvido o vínculo do 1042), a regra pode
 * colapsar em `answered_at` puro — hoje isso cegaria os ramais sem webhook.
 */
export function isConnectedCall(call: CallConnectionSignals): boolean {
  // Override do SDR (fase 2 da taxa de conexão): caixa postal/secretária. A
  // telefonia marca `answered_at` (a máquina atendeu), mas não houve humano — o
  // SDR confirmou via `voicemail`. Vem ANTES de tudo para corrigir o único
  // falso-positivo que sobrava no lado "answered".
  if (call.sdr_disposition === 'voicemail') return false;
  if (call.answered_at) return true;
  if (call.status === 'significant') return true;
  return call.duration_seconds >= CONNECTED_MIN_DURATION_SECONDS;
}

/**
 * Conversa relevante — o bucket qualitativo que o classificador atribui quando
 * a duração passa do limite significativo configurado pela org.
 *
 * Sempre um SUBCONJUNTO de `isConnectedCall`. Antes deste módulo o Painel de
 * Ligações calculava `significant = connected`, então os cards "Taxa de
 * Conexão" e "Taxa de Significativas" exibiam sempre o mesmo número.
 */
export function isSignificantCall(call: Pick<CallConnectionSignals, 'status'>): boolean {
  return call.status === 'significant';
}

/** Colunas mínimas que uma query precisa trazer para alimentar os helpers. */
export const CALL_CONNECTION_COLUMNS = 'status, duration_seconds, answered_at, sdr_disposition' as const;
