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
 * Piso de duração de conversa para uma ligação contar como CONECTADA (14/ago/2026).
 * Decisão de negócio da V4: "conectada = falou de verdade com o lead", e isso é
 * uma ligação atendida de pelo menos 50s. Abaixo disso, o atendimento é
 * predominantemente caixa postal/secretária ou "alô?"+desligou (ver abaixo).
 */
export const CONNECTED_MIN_DURATION_SECONDS = 50;

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
  /**
   * Causa de encerramento crua do provedor (API4COM `hangupCause`). Usada SÓ no
   * proxy de ramal-sem-webhook: `NORMAL_CLEARING` (encerramento normal de uma
   * chamada atendida) é o único valor que, combinado com gravação + duração real,
   * comprova conversa. Fracasso de discagem tem outra causa (NUMBER_CHANGED,
   * ORIGINATOR_CANCEL, UNALLOCATED_NUMBER...) e por isso NÃO passa.
   */
  hangup_cause?: string | null;
  /**
   * URL da gravação. No proxy sem-webhook, exigir gravação é a prova de que houve
   * áudio de conversa (a linha "abriu"). Sozinha não basta — a operadora também
   * grava o aviso de "número alterado" —, por isso vem casada com `NORMAL_CLEARING`.
   */
  recording_url?: string | null;
}

/**
 * A ligação foi uma CONVERSA real com o lead — regra "answered + piso de 50s".
 *
 * REGRA (14/ago/2026): conectada = NÃO-voicemail  E  `answered_at` presente
 * (o provedor confirmou channel-answer)  E  duração >= 50s.
 *
 * POR QUE `answered_at` SOZINHO NÃO BASTA (o que esta versão corrige)
 *
 * A regra anterior contava QUALQUER ligação com `answered_at` como conectada.
 * Depois que os webhooks de todos os ramais voltaram a emitir `channel-answer`
 * (incl. 1042/1045), ficou provado que a API4COM dispara o answer também quando
 * a CAIXA POSTAL / SECRETÁRIA / gravação de operadora ATENDE a linha — não um
 * humano. Evidência (ago/2026): 41% das "conectadas" eram atendimentos de <10s,
 * com pico em 0-5s; 21 ligações para número inexistente (UNALLOCATED_NUMBER, 0s)
 * vinham com `answered_at`; e as transcrições dos curtos são operadora/caixa
 * postal ("sua ligação foi encaminhada", "este número mudou", "verifique o
 * número discado"). O piso de 50s remove esse balde de máquina: o conjunto que
 * sobra é 100% `NORMAL_CLEARING`/`FINISHED` com média de ~180s — conversa de fato.
 *
 * `sdr_disposition='voicemail'` continua excluído ANTES de tudo (o SDR confirmou
 * a caixa postal no atendimento longo que a máquina segurou).
 *
 * TRADE-OFFS ASSUMIDOS (decisão de negócio da V4 — "50s pra tudo"):
 *  - Exige `answered_at`: um ramal cujo webhook pare de emitir channel-answer
 *    fica sem conexão medida (hoje todos emitem; ver relatório API4COM). O proxy
 *    de "ramal-sem-webhook" (NORMAL_CLEARING+gravação) foi removido junto.
 *  - `significant` (status, piso de 30s da org) DEIXA de ser, sozinho, sinal de
 *    conexão. Logo `significant ⊆ conectadas` não vale mais para 30-49s (poucas
 *    linhas); é intencional — "conectada" agora é mais estrita que "significativa".
 *
 * `hangup_cause` / `recording_url` não são mais lidos aqui (a regra é answered +
 * duração), mas seguem no payload/colunas para paridade com o BI e diagnóstico.
 */
export function isConnectedCall(call: CallConnectionSignals): boolean {
  if (call.sdr_disposition === 'voicemail') return false;
  return Boolean(call.answered_at) && call.duration_seconds >= CONNECTED_MIN_DURATION_SECONDS;
}

/**
 * Conversa relevante — o bucket qualitativo que o classificador atribui quando
 * a duração passa do limite significativo configurado pela org (30s default).
 *
 * NOTA: com o piso de conexão em 50s (14/ago), `significant` NÃO é mais um
 * subconjunto estrito de `isConnectedCall` — uma conversa de 30-49s pode ser
 * `significant` sem ser "conectada". São poucas linhas (a maioria das
 * significativas passa de 50s), mas a Taxa de Significativas pode, em tese,
 * ficar marginalmente acima da Taxa de Conexão. É esperado, dado o critério de
 * negócio "conectada = conversa de pelo menos 50s".
 */
export function isSignificantCall(call: Pick<CallConnectionSignals, 'status'>): boolean {
  return call.status === 'significant';
}

/** Colunas mínimas que uma query precisa trazer para alimentar os helpers. */
export const CALL_CONNECTION_COLUMNS =
  'status, duration_seconds, answered_at, sdr_disposition, hangup_cause, recording_url' as const;
