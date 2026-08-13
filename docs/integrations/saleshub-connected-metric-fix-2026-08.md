# Correção da métrica "ligações conectadas" no Sales Hub

**Data:** 12/08/2026
**Projetos:** Enriquece (`dhkmonctyoaenejemkrt`) e Sales Hub (`ejxlbbbjyexsoltsxiqq`)
**Status:** ✅ APLICADO em 12/08/2026 via MCP (ver "Resultado" no fim)

---

## Problema

A contagem de "ligações conectadas" dos SDRs está **inflada ~2–3×** no Sales Hub, no período **até julho/2026**:

| SDR | jul mostrado (SH) | jul real | falsas |
|-----|-------------------|----------|--------|
| Matheus (1028) | 3.062 (~96%) | ~1.357 (~43%) | ~1.704 |
| Guilherme (1033) | 1.834 (~97%) | ~661 (~35%) | ~1.173 |

**Agosto já está correto** (falsas = 0) — o número menor de agosto é o real, não uma queda de performance.

## Causa-raiz

A regra de "conectada" no pipeline é `status IN ('significant','not_significant')`, em **3 lugares**:
1. Sales Hub — `sync_calls_from_enriquece(jsonb)` → `v_connected`.
2. Enriquece — `get_calls_for_v4sales(p_from_date text, p_limit int)` (a que o n8n chama) — **não** calcula connected, mas **não exporta `answered_at`**.
3. Enriquece — `get_calls_for_v4sales(p_year int, p_month int)` (overload de métricas) → `ligacoes_conectadas`.

O balde `not_significant` foi contaminado pelo bug do `answeredAt=""` (corrigido no app em 02/08, PR #207): ligações **não atendidas** (NUMBER_CHANGED, ORIGINATOR_CANCEL...) viravam `not_significant`, e a regra as conta como conectadas. O fix parou a contaminação **daqui pra frente**, mas o **histórico** (jun/jul e antes) segue contaminado na tabela `calls` e foi sincronizado assim.

**Discriminador correto:** só `answered_at` distingue a atendida-curta real (`not_significant` com answer) da falsa (`not_significant` sem answer, duração ~0). Por isso a regra tem que ser **answered-first**, e o `answered_at` precisa chegar ao Sales Hub (hoje não chega no payload).

## Correção going-forward (3 mudanças)

### A. Enriquece — exportar `answered_at` (`get_calls_for_v4sales` p_from_date)
```sql
CREATE OR REPLACE FUNCTION public.get_calls_for_v4sales(p_from_date text DEFAULT NULL::text, p_limit integer DEFAULT 500)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_catalog'
AS $function$
DECLARE
    v_from timestamptz;
    v_org_id uuid := 'c2727473-1df8-4faa-9264-a9fc1759fe3b';
BEGIN
    v_from := COALESCE(p_from_date::timestamptz, date_trunc('month', CURRENT_DATE));
    RETURN (
        SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb)
        FROM (
            SELECT id, user_id, origin, destination, started_at, duration_seconds,
                   status, type, recording_url, transcription, metadata,
                   answered_at                       -- NOVO
            FROM public.calls
            WHERE org_id = v_org_id AND started_at >= v_from
            ORDER BY started_at DESC
            LIMIT p_limit
        ) c
    );
END;
$function$;
```

### B. Sales Hub — regra answered-first (`sync_calls_from_enriquece`)
Trocar **apenas** a linha do `v_connected` (o resto da função fica igual):
```sql
-- ANTES:
-- v_connected := v_status IN ('significant', 'not_significant');
-- DEPOIS (answered-first, igual ao isConnectedCall do app):
v_connected := (v_call->>'answered_at') IS NOT NULL
            OR v_status = 'significant'
            OR COALESCE((v_call->>'duration_seconds')::int, 0) >= 30;
```
Nada mais muda — não precisa de coluna nova (lê `answered_at` inline do payload). Preserva as reais, exclui as falsas (dur ~0, sem answer), e **não zera 1042/1045** (usa a duração como rede).

### C. Enriquece — overload de métricas (`get_calls_for_v4sales` p_year/p_month), SE ainda for consumido
```sql
-- ANTES: COUNT(*) FILTER (WHERE c.status IN ('significant','not_significant'))
-- DEPOIS:
COUNT(*) FILTER (
  WHERE c.answered_at IS NOT NULL OR c.status = 'significant' OR c.duration_seconds >= 30
) AS ligacoes_conectadas
-- (ajustar também o pct_conectadas com o mesmo FILTER)
```

## Re-sync do histórico (jun/jul)

O n8n só busca o **mês corrente** (`p_from_date = início do mês`), então re-rodá-lo NÃO corrige jun/jul. E a export RPC tem `LIMIT 500`. Duas opções:

**Opção 1 (recomendada) — correção direta no Sales Hub, cross-project.**
Como o discriminador (`answered_at`) está na Enriquece e o `call_logs` do SH não o tem, a forma mais limpa é corrigir o `call_logs.connected` histórico a partir dos `api4com_call_id` que a Enriquece sabe serem falsos, e recomputar as metas:
```sql
-- No Sales Hub, para os api4com_call_id falsos (lista vinda da Enriquece):
UPDATE call_logs SET connected = false
WHERE started_at >= '2026-05-01' AND started_at < '2026-08-02'
  AND api4com_call_id = ANY($1);   -- ids das not_significant sem answer e dur<30

-- Recompute das metas mensais afetadas:
INSERT INTO pdi_monthly_goals (member_id, year, month, indicator_key, actual_value, source, updated_at)
SELECT cl.member_id, EXTRACT(YEAR FROM cl.started_at)::int, EXTRACT(MONTH FROM cl.started_at)::int,
       'ligacoes_conectadas', COUNT(*) FILTER (WHERE cl.connected)::numeric, 'api4com', now()
FROM call_logs cl
WHERE cl.started_at >= '2026-06-01' AND cl.started_at < '2026-08-01'
GROUP BY 1,2,3
ON CONFLICT (member_id, year, month, indicator_key)
DO UPDATE SET actual_value = EXCLUDED.actual_value, updated_at = now();
```
A lista de `api4com_call_id` falsos vem desta query na **Enriquece**:
```sql
SELECT COALESCE(metadata->>'api4com_call_id', id::text) AS api4com_call_id
FROM public.calls
WHERE org_id = 'c2727473-1df8-4faa-9264-a9fc1759fe3b'
  AND started_at >= '2026-05-01' AND started_at < '2026-08-02'
  AND status = 'not_significant' AND answered_at IS NULL AND duration_seconds < 30;
```

**Opção 2 — re-sync via pipeline.** Aplicar A e B, criar temporariamente uma export por período (jun/jul, sem LIMIT ou paginada) e alimentar o `sync_calls_from_enriquece` (que faz upsert por `api4com_call_id`). Mais fiel ao fluxo real, porém mexe no n8n e na paginação.

## Ordem de aplicação e validação

1. Aplicar **A** (Enriquece) e **B** (Sales Hub) — going-forward passa a ser answered-first (mais robusto; não teria caído no bug).
2. Rodar o **re-sync histórico** (Opção 1) para jun/jul (e meses anteriores se necessário).
3. Validar: `SELECT month, SUM(...) FROM pdi_monthly_goals WHERE indicator_key='ligacoes_conectadas'` por SDR deve bater com a conexão real da Enriquece (`answered_at IS NOT NULL OR status='significant' OR duration>=30`).

> ⚠️ Isto altera métrica de performance dos SDRs no BI da V4. Aplicar após validação do time.

---

## Resultado (aplicado 12/08/2026)

Going-forward: FIX A + C aplicados na Enriquece (migration `20260812120000_get_calls_for_v4sales_answered_first.sql`); FIX B aplicado no Sales Hub (`sync_calls_from_enriquece`). Histórico mai–jul: **23.329 linhas de `call_logs` recomputadas** + `pdi_monthly_goals` recalculado. A transferência dos 3.606 IDs de atendidas-curtas reais foi feita **server-side** (Enriquece → Sales Hub via `net.http_post` + RPC temporária gated por segredo, já removida) — sem trafegar dados sensíveis fora do banco.

**Antes → Depois (ligações conectadas, julho/2026):**

| SDR | ANTES | DEPOIS | |
|-----|-------|--------|---|
| Matheus Martins (1028) | 3.062 | 1.463 | −1.599 falsas |
| Ismael Dobelin (1024) | 1.917 | 733 | −1.184 falsas |
| Guilherme Marques (1033) | 1.834 | 693 | −1.141 falsas |
| Giovanni Olivieri (1042) | 0 | 685 | +685 (estava sub-contado) |
| Vinicius (1014) | 159 | 62 | −97 |

Correção de dois lados: ramais com webhook (inflados) foram deflacionados ao real; ramais sem webhook (Giovanni) foram corrigidos para cima (as conversas reais via duração que nunca tinham entrado). Agosto já estava correto (não alterado). Durável: o n8n só re-sincroniza o mês corrente, então o histórico não volta a inflar.

---

## Atualização 13/08/2026 — "Opção B" (remove o fallback de duração crua)

**Motivo:** o dashboard do Enriquece mostrava conexão ainda altíssima (Matheus 43%, meta 17%), e a virada answered-first de 12/08 **ainda carregava `duration_seconds >= 30` como fallback**. Os dados de agosto provaram que esse fallback conta **fracasso de discagem** como conexão: a operadora deixa a gravação de aviso ("número alterado…") tocando 30-500s em não-atendimentos (NUMBER_CHANGED, ORIGINATOR_CANCEL, UNALLOCATED_NUMBER), todos com `answered_at` nulo e `status='not_connected'`. Em agosto: ~570 falsas conexões/mês na org. E nem "salvava" o ramal sem webhook — Giovanni/1042 tinha 197 dessas, `not_connected`, só 7 com gravação.

**Regra nova (Opção B), alinhada ao `isConnectedCall` do app:**
```
conectada = answered_at válido
         OU status='significant'
         OU (hangup_cause='NORMAL_CLEARING' E tem gravação E duração>=30)   ← proxy sem-webhook
         E  sdr_disposition <> 'voicemail'
```
O proxy resgata a conversa genuína de ramais sem webhook (`answered_at` nunca chega — defeito da API4COM que não emite `channel-answer`) exigindo **prova positiva**: encerramento normal de chamada atendida + gravação de áudio + duração real. `NORMAL_CLEARING` é o separador — fracasso de discagem tem outra causa.

**Mudanças (13/08):**
- **Enriquece** — export RPC `get_calls_for_v4sales` passa a exportar `hangup_cause` e `sdr_disposition` (p_from_date) e a usar Opção B no `ligacoes_conectadas` (p_year/p_month). Migration `20260813061500_get_calls_for_v4sales_option_b_connection.sql`.
- **Sales Hub** — `sync_calls_from_enriquece` → `v_connected` passa à Opção B (usa `hangup_cause`/`recording_url`/`sdr_disposition` do payload). Aplicado via MCP.
- **App** — `isConnectedCall` (`src/features/calls/connection.ts`) é a fonte única; a mesma regra vale pro card do dashboard, Painel de Ligações e Extrato.

**Recompute do histórico (Abr-Ago):** o `raw_payload` histórico do SH **não tinha `answered_at` nem `hangup_cause`** (o export só passou a mandá-los em 12–13/08), então a recomputação exigiu **re-puxar do Enriquece** (única fonte com todos os campos). Feito server-side: `net.http_post` do Enriquece → RPC temporária `apply_conn_fix_v1` (gated por segredo, granted a anon, **já removida**), enviando `{id, connected_correto}` por mês. **2.451 linhas corrigidas** (Abr 100, Mai 393, Jun 823, Jul 832, Ago 303). `pdi_monthly_goals.ligacoes_conectadas` recalculado.

**Connected por mês, antes → depois (Opção B), no `call_logs` do SH:**

| Mês | answered-first (12/08) | **Opção B (13/08)** |
|-----|------------------------|---------------------|
| Abr | 182 | **282** * |
| Mai | 1.869 | **1.486** |
| Jun | 2.503 | **1.680** |
| Jul | 3.636 | **2.804** |
| Ago | 994 | **714** |

\* *Abr subiu porque o SH não tinha `answered_at` no payload histórico e estava sub-contado; a Opção B, com os campos re-puxados do Enriquece, corrigiu pra cima até o valor real.*

**Paridade por SDR (agosto) SH ↔ Enriquece Opção B:** Guilherme 222=222, Ismael 226=226, Matheus 194=194, João 57=57, Vinicius 7=7. Giovanni 8≈11 (baixo dos dois lados — telefonia dele quebrada na API4COM; ver relatório `api4com-webhook-report-2026-08.md`).
