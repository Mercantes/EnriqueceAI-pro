# Runbook — migrar um SDR do API4COM para o Callface

**Caso concreto:** Giovanni Olivieri (ramal API4COM **1042**, que não emite
`channel-answer` → conexão dele em 1,6%, leads congelam). Serve de **template**
para qualquer SDR (foi assim que o João/1045 foi migrado).

**Data:** 13/08/2026 · **Org:** V4 Amaral (`c2727473-1df8-4faa-9264-a9fc1759fe3b`)

---

## Por que migrar

O ramal 1042 do Giovanni no API4COM não entrega `channel-answer`/`answeredAt`
(defeito na origem, ver `api4com-webhook-report-2026-08.md`). Isso não tem fix do
nosso lado. O Callface é a 2ª fonte de ligações da V4, com **pipeline limpo**
(preenche `answered_at` quando conectada) e já usado por João, Matheus e Guilherme.
Migrar o Giovanni = ele passa a **discar pelo Callface**; o resto flui automático e
a conexão dele volta a ser medida de verdade.

> Isto **não mexe nos leads** dele — só destrava a vazão. Os leads que ele já tem
> passam a ser trabalháveis num canal que funciona.

---

## A chave técnica (make-or-break)

O `ingest_callface_call` (RPC no Enriquece) amarra cada ligação ao SDR **apenas
pelo e-mail**:

```
v_email := lower(trim(payload->>'user_email'));
SELECT user_id, org_id FROM organization_members om
  JOIN auth.users u ON u.id=om.user_id
 WHERE lower(u.email) = v_email;     -- sem match → reason='user_not_found', ligação DESCARTADA
```

Os 3 SDRs que já usam Callface estão mapeados por `metadata.user_email` = e-mail
`@v4company.com` exato, no workspace **"Pré-vendas - Wall Street"**.

⭐ **Portanto: a conta do Giovanni no Callface TEM que usar exatamente**
```
giovanniolivieri@v4company.com
```
(case-insensitive, mas sem typo, sem e-mail pessoal, sem alias). É o ponto que faz
ou quebra a migração. O lead é casado por telefone (`find_lead_id_by_phone`) —
isso é automático, não precisa config.

---

## Passo-a-passo

### Parte A — Lado Callface (V4/time; eu NÃO tenho acesso à plataforma)

1. **Criar/ativar o seat do Giovanni** no workspace **"Pré-vendas - Wall Street"**
   com e-mail **`giovanniolivieri@v4company.com`** (exato). ← *make-or-break*
2. **Atribuir uma linha/número de saída (DID)** a ele para discar.
3. **Confirmar cobertura do webhook:** o fluxo que alimenta o n8n
   (`CC1zZHetFviVHD3O`) dispara por **workspace** — como o Giovanni entra no mesmo
   workspace dos outros 3, deve ser coberto automaticamente. Confirmar que o
   webhook de fim-de-ligação está ligado para o novo usuário.
4. **Giovanni passa a discar pelo app/softphone do Callface** — não pelo discador
   API4COM dentro do Enriquece.

### Parte B — Lado Enriquece (automático; nada a construir)

Nenhuma mudança de código nem de n8n. O fluxo **"Callface → EnriqueceAI"**
(`CC1zZHetFviVHD3O`) já ingere todas as ligações do workspace e resolve o SDR por
e-mail dinamicamente. Assim que o e-mail do Giovanni bater:
- as ligações entram em `calls` com `origin='callface'`, casam com o lead por
  telefone, e **contam nas métricas e no BI** (a regra Opção B já trata; Callface
  preenche `answered_at`, então conexão é medida certa);
- o trigger durável "Disparar Sync V4" já leva ao Sales Hub na hora.

### Parte C — Desligar o ruído do API4COM (recomendado)

O ramal 1042 dele segue miscontando (sem `answered_at`). Para não confundir:
- **Opção limpa:** desconectar/pausar a conexão API4COM do Giovanni no Enriquece
  (Configurações → Integrações → API4COM do usuário), para ele discar **só** pelo
  Callface. Cada ligação é feita num canal só — não há risco de duplicar registro,
  mas usar dois canais duplica esforço e polui a comparação.
- Se preferir manter os dois por um tempo, orientar o Giovanni a discar apenas
  pelo Callface enquanto valida.

---

## Verificação (eu rodo, após a 1ª ligação de teste dele)

**1. O e-mail bateu? (detecta `user_not_found` — o erro nº 1)**
```sql
SELECT received_at, ok, reason,
       payload->>'user_email' AS cf_email, lead_matched
FROM callface_events
WHERE payload->>'user_email' ILIKE 'giovanni%'
ORDER BY received_at DESC LIMIT 10;
-- ok=true  → mapeou certo.
-- ok=false, reason='user_not_found' → o e-mail no Callface está diferente de
--   giovanniolivieri@v4company.com. Corrigir na Parte A.1 e refazer a ligação.
```

**2. A ligação entrou como do Giovanni?**
```sql
SELECT c.started_at, c.status, c.connected, c.duration_seconds, c.answered_at IS NOT NULL AS tem_answer
FROM calls c JOIN auth.users au ON au.id=c.user_id
WHERE c.origin='callface' AND au.email='giovanniolivieri@v4company.com'
ORDER BY c.started_at DESC LIMIT 10;
```

**3. Conexão dele voltando (dias depois):** rodar a mesma replicação do card
(Opção B) e ver o % subir dos 1,6% atuais conforme ele acumula ligações Callface.

---

## Cuidados / rollback

- **Reversível:** tudo é config no Callface; nada destrutivo no Enriquece.
- **Não redistribui leads** — decisão separada (ver diagnóstico
  `docs/sessions/2026-08/2026-08-13-carga-giovanni-diagnostico-sem-acao.md`).
- **Não some com o histórico API4COM** dele — as ligações antigas ficam; só o
  canal novo passa a valer daqui pra frente.

## Referências

- [[callface-integration]] — pipeline, `ingest_callface_call`, trigger de sync.
- [[api4com-connected-empty-answered-at-bug]] — o defeito do ramal 1042.
- [[calls-connected-metric-unified]] — regra Opção B (conta a conexão Callface certo).
