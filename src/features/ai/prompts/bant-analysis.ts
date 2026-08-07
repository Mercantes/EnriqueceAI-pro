/**
 * Prompt for BANT qualification analysis from call transcription.
 * Field names MUST match the custom_fields.field_name values in the database.
 *
 * BANT = Budget, Autoridade, Necessidade, Timing. Substitui o antigo SPICED.
 * Mantém 3 campos auxiliares úteis pro closer: Oportunidades, Gaps da ligação,
 * Observação Decisor.
 */

const BANT_FIELDS: Array<{ dbName: string; promptName: string; description: string; maxChars: number }> = [
  {
    dbName: 'B (Budget)',
    promptName: 'B - Budget',
    maxChars: 1200,
    description:
      'O que você entendeu sobre a grana do lead e como ele se comporta com dinheiro. Faturamento, ticket médio, quanto ele já joga em marketing/vendas/tráfego hoje, se tem fôlego ou tá apertado, se topou investir ou travou no preço. Traga a sensação também: ele falou de dinheiro tranquilo ou ficou desconfortável? Achou caro, chorou desconto? Quantifique os números que ele deu.',
  },
  {
    dbName: 'A (Autoridade)',
    promptName: 'A - Autoridade',
    maxChars: 1200,
    description:
      'Quem manda ali e como a decisão anda. Se o contato decide sozinho ou depende de sócio/esposa/conselho, quem mais entra, a alçada dele, e como ele se posiciona (seguro, inseguro, vai ter que "vender pra dentro"). Registre o jeitão do decisor e como ele conduz — ex.: "o Ricardo é bem direto, decide na hora" ou "ele enrola, vai ter que levar pros sócios".',
  },
  {
    dbName: 'N (Necessidade)',
    promptName: 'N - Necessidade',
    maxChars: 1200,
    description:
      'A dor real e o quanto ela aperta. O que ele quer resolver, por que agora, o que tá travando ou doendo, e quanto isso custa pra ele. Traga o emocional: tava ansioso pra resolver? Cansado do problema? Cético de que dá pra melhorar? Empolgado com a possibilidade? Mostre o quanto isso pesa no dia a dia dele.',
  },
  {
    dbName: 'T (Timing)',
    promptName: 'T - Timing',
    maxChars: 1200,
    description:
      'A urgência de verdade E o quanto dá pra ACELERAR. Tem prazo, evento ou gatilho concreto? Quer pra ontem ou tá só pesquisando? Percebeu pressa ou enrolação? E principalmente: dá pra puxar? Ex.: "quer resolver antes de abrir a 2ª loja", "falou em contratar mês que vem, mas senti que se o closer puxar ele vem antes", "me pareceu sem pressa, só cotando".',
  },
  {
    dbName: 'Oportunidades',
    promptName: 'Oportunidades',
    maxChars: 700,
    description:
      'As brechas que você enxergou pra V4 — canais parados, ativos subutilizados, gaps de mercado, diferenciais, coisas que dá pra destravar rápido. Escreve como quem já viu onde tem dinheiro na mesa.',
  },
  {
    dbName: 'Gaps da ligação',
    promptName: 'Gaps',
    maxChars: 700,
    description:
      'O que ficou faltando descobrir na call, pro closer puxar na reunião. Organize por categoria, exatamente assim:\n\nFinanceiros:\n- pergunta\n\nOperacionais:\n- pergunta\n\nEstratégicos:\n- pergunta\n\nDecision Process:\n- pergunta\n\nSe uma categoria não tiver gaps, escreva "- nenhum".',
  },
  {
    dbName: 'Observação Decisor',
    promptName: 'Observacao',
    maxChars: 700,
    description:
      'O seu "feeling" + as NUANCES que ajudam o closer a conduzir. Traga: (1) PERSONALIDADE e ESTILO — direto ao ponto vs prolixo, técnico, informal, mandão, inseguro. Ex.: "é mais direto ao ponto, não enrola". (2) TERMÔMETRO / dica de fechamento — o quão quente e fechável ele está e COMO puxar. Ex.: "essa é fechamento, só puxar"; "diz que quer contratar mês que vem, mas se der uma puxada ele vem antes"; "vai precisar amadurecer, não adianta forçar". (3) GANCHOS DE RAPPORT — gostos, paixões e assuntos que engajam ele, que o closer pode usar pra criar conexão. Ex.: "adora falar de política, curte o presidente Lula"; "torce pro Palmeiras"; "puxou papo de filho". (4) CLIMA — química, red flags, o que fez ele abrir ou travar. Ex.: "cara gente boa, mas ansioso", "super técnico, vai querer número". Só registre gostos/opiniões/temperatura que ELE de fato demonstrou na call. Se não houver nada relevante, retorne "".',
  },
];

/** Known BANT field names for matching against custom_fields table */
export const BANT_FIELD_NAMES = BANT_FIELDS.map((f) => f.dbName);

/** Map from prompt response key → database field name */
const PROMPT_TO_DB = new Map(BANT_FIELDS.map((f) => [f.promptName, f.dbName]));

export function mapBantResponseToDbNames(response: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(response)) {
    const dbName = PROMPT_TO_DB.get(key);
    if (dbName && value) {
      mapped[dbName] = value;
    }
  }
  return mapped;
}

/** Lead context passed to the prompt as cabeçalho */
export interface BantLeadContext {
  decisorNome?: string | null;
  decisorCargo?: string | null;
  empresa?: string | null;
  cnpj?: string | null;
  segmento?: string | null;
  cidade?: string | null;
  uf?: string | null;
  origem?: string | null;
  site?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  outrosCanais?: string | null;
}

function formatLeadContext(ctx: BantLeadContext | undefined): string {
  if (!ctx) return 'Não fornecido.';
  const parts: string[] = [];
  if (ctx.decisorNome) parts.push(`Decisor: ${ctx.decisorNome}${ctx.decisorCargo ? ` — ${ctx.decisorCargo}` : ''}`);
  if (ctx.empresa) parts.push(`Empresa: ${ctx.empresa}`);
  if (ctx.cnpj) parts.push(`CNPJ: ${ctx.cnpj}`);
  if (ctx.segmento) parts.push(`Segmento: ${ctx.segmento}`);
  const local = [ctx.cidade, ctx.uf].filter(Boolean).join('/');
  if (local) parts.push(`Região: ${local}`);
  if (ctx.origem) parts.push(`Origem do lead: ${ctx.origem}`);
  if (ctx.site) parts.push(`Site: ${ctx.site}`);
  if (ctx.instagram) parts.push(`Instagram: ${ctx.instagram}`);
  if (ctx.linkedin) parts.push(`LinkedIn: ${ctx.linkedin}`);
  if (ctx.outrosCanais) parts.push(`Outros canais: ${ctx.outrosCanais}`);
  return parts.length > 0 ? parts.join('\n') : 'Não fornecido.';
}

export function buildBantAnalysisPrompt(
  transcription: string,
  leadContext?: BantLeadContext,
): string {
  const fieldDescriptions = BANT_FIELDS
    .map((f) => `${f.promptName} (máximo ${f.maxChars} caracteres):\n${f.description}`)
    .join('\n\n');

  const jsonKeys = BANT_FIELDS.map((f) => `"${f.promptName}": "..."`).join(', ');

  return `Você é o próprio SDR que acabou de sair desta ligação e está escrevendo, do seu jeito, as anotações para entregar ao closer que vai conduzir a reunião. O closer NÃO participou da call — as suas anotações são os olhos e ouvidos dele. Escreva como um vendedor experiente contaria pro colega antes de passar o bastão.

COMO ESCREVER (o mais importante)
- Escreva como GENTE de verdade, na primeira pessoa: "senti que...", "o cara...", "ela deixou claro que...", "achei que...". NADA de cara de relatório ou de texto de IA.
- Evite jargão corporativo, frases genéricas e aquele tom robótico. Se soar como um vendedor humano anotando na correria, tá certo.
- Comece cada campo pela informação que MAIS importa pro closer (o número, o nome, o fato-chave, a recomendação): o PRIMEIRO bullet é o resumo; os seguintes trazem o contexto e a leitura.
- Vá ALÉM dos dados: capte o lado humano da conversa — o humor e o estado do lead (ansioso, empolgado, desconfiado, desanimado, cético, com pressa, cansado do problema), a personalidade e o estilo dele (direto, prolixo, técnico, informal, mandão, inseguro), o nível de interesse, a química da conversa, o tom das objeções, o que fez ele abrir ou travar. Ex.: "o Ricardo é bem direto, não gosta de rodeios", "senti o lead meio desgostoso do próprio negócio", "ela tava ansiosa pra resolver isso ontem".
- Capte as NUANCES que um vendedor experiente percebe e que valem ouro pro closer: (a) o TERMÔMETRO — o quão fechável o lead está e como puxar ("essa é fechamento, só puxar"; "diz que é mês que vem, mas se der uma puxada ele vem"); (b) GANCHOS de conexão — gostos, paixões e assuntos que engajam ele (política, futebol, família, hobbies, quem ele admira ou critica); (c) o ESTILO dele (direto ao ponto, prolixo, técnico, informal). Essas nuances vão principalmente na "Observacao".
- Seja completo, mas SEM ENCHER LINGUIÇA: se o assunto rendeu pouco na call, seja curto. Não escreva um parágrafo só pra dizer que não teve informação — os limites de caracteres são TETO, não meta.

REGRAS DE HONESTIDADE
- Seja honesto e crítico. Não suavize. Se o lead é fraco ou tem red flag, diga com todas as letras.
- NÃO invente nada. Use SÓ o que foi dito na call + o cabeçalho do lead. O que não apareceu, jogue em "Gaps". Se um campo não teve informação, retorne string vazia "".
- Separe FATO de IMPRESSÃO: fato = o que o lead falou; impressão = a sua leitura ("me pareceu", "senti", "achei"). Nunca transforme achismo em fato. Vale pro termômetro e pros ganchos também — só registre gostos, opiniões e nível de interesse que ele REALMENTE demonstrou.
- Quantifique os números que o lead deu (faturamento, ticket, verba, prazos, conversão).

FORMATAÇÃO
- Português BEM informal, do jeito que um vendedor mandaria num áudio ou mensagem rápida pro colega — zero tom corporativo, zero formalidade. Pode escrever "na correria", com gíria leve.
- Escreva CADA campo (B, A, N, T, Oportunidades, Observacao) em BULLET POINTS, pra facilitar a leitura do closer: cada linha começa com "- " e traz uma ideia curta e direta. O PRIMEIRO bullet é o resumo/punchline; os seguintes destrincham. Separe os bullets com quebra de linha (\n).
- O campo "Gaps" mantém o formato por categoria já descrito nele (Financeiros/Operacionais/Estratégicos/Decision Process).
- SEM markdown — nada de #, *, negrito, títulos. O bullet é só o hífen "- ".
- RESPEITE o limite máximo de caracteres de cada campo (é TETO, não meta).

CABEÇALHO DO LEAD
${formatLeadContext(leadContext)}

TRANSCRIÇÃO DA CALL
${transcription}

CAMPOS A PREENCHER

${fieldDescriptions}

FORMATO DE RESPOSTA
Responda APENAS com JSON válido, sem markdown, sem explicações adicionais. Use exatamente as chaves abaixo:
{${jsonKeys}}`;
}
