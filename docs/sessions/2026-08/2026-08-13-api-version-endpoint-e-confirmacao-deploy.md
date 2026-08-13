<!-- Sessão: endpoint /api/version + confirmação de deploy no Coolify -->
<!-- Data: 2026-08-13 -->
<!-- App: EnriqueceAI (app.enriqueceai.com.br) — deploy Coolify -->

## Motivo

Após mergear a correção de conexão (#277), não havia como **confirmar de fora**
qual código estava rodando ("CI verde ≠ deploy no ar" — já tivemos deploy travado
por disco cheio servindo build antigo). As tentativas de verificação externa
falharam porque:

- **Fingerprint de bundle não detecta mudança server-side.** O bundle client da
  `/login` fica idêntico mesmo com mudança em Server Actions/serviços — então
  "bundle igual por 10 min" NÃO é sinal de deploy travado, é o esperado.
- **Não existia endpoint de versão** (`/api/health` só devolve `{status:'ok'}`).
- **Cloudflare mascara os headers de origem** (só se vê `cf-ray`).
- O card de conexão exige **login** (sem credencial, sem verificação funcional).

## Solução: `GET /api/version`

Retorna o commit git do build. Confirmar deploy vira um comando:
```bash
curl -s https://app.enriqueceai.com.br/api/version
# → {"status":"ok","commit":"<sha>","commitShort":"<sha7>","source":"SOURCE_COMMIT","nodeEnv":"production"}
```
Compara `commit` com `git rev-parse origin/main`.

### De onde vem o commit (lição — 2 iterações)

1ª tentativa (#280) assumiu que o Coolify passa `SOURCE_COMMIT` como **build-arg**
do Docker (`ARG SOURCE_COMMIT` no stage runner + `ENV APP_COMMIT`). **Errado:** o
Coolify NÃO passa build-arg, e `.git` está no `.dockerignore` (baking no build
também não serve). Resultado: endpoint no ar, mas `commit: "unknown"`.

2ª tentativa (#284, a que funcionou): ler **`process.env.SOURCE_COMMIT` no
RUNTIME** — o Coolify injeta essa env no ambiente do container. A rota lê, em
ordem (primeiro não-vazio vence): `SOURCE_COMMIT` → `APP_COMMIT` (build-arg, se
configurado) → `COOLIFY_GIT_COMMIT_SHA`, e expõe o campo `source` para
auto-diagnóstico (`none` = nenhuma env presente).

⭐ **Coolify: o commit do deploy está em `SOURCE_COMMIT` no RUNTIME do container,
não em build-arg.** (Consistente com [[meeting-webhook-n8n-dispatch]]: "env do
Coolify chega ao runtime, não ao build" — aqui o inverso confirma o mesmo eixo.)

## Arquivos

- `src/app/api/version/route.ts` — GET público, `force-dynamic`, multi-fonte + `source`.
- `src/middleware.ts` — `/api/version` entrou na `API_PUBLIC_PREFIXES` (senão o
  middleware redireciona pro login — pegou no 1º teste local).
- `Dockerfile` — stage runner ganhou `ARG SOURCE_COMMIT` + `ENV APP_COMMIT`
  (caminho build-arg; hoje inócuo pois o Coolify não passa o arg, mas é fallback
  válido se configurado no painel).

PRs: **#280** (endpoint + Dockerfile + middleware), **#284** (fix runtime). Ambos
mergeados e deployados.

## Confirmação em produção

Após o merge do #284, o endpoint assumiu em **~2,5 min**:
```json
{"status":"ok","commit":"e1de8dfc0fae04057f69350aa3b1b92e6be3891f","commitShort":"e1de8df","source":"SOURCE_COMMIT","nodeEnv":"production"}
```
`commit` = main HEAD (`e1de8df`), `source: SOURCE_COMMIT`.

**Provado:** (1) o deploy do Coolify sobe (build novo assumiu em ~2,5 min); (2) por
transitividade, #277 (correção de conexão Opção B), #280 e #284 estão todos no ar;
(3) o "CI verde ≠ deploy no ar" deixou de ser ponto cego.

## Como usar daqui pra frente

```bash
# 1. commit no ar
curl -s https://app.enriqueceai.com.br/api/version | grep -o '"commit":"[^"]*"'
# 2. commit esperado
git rev-parse origin/main
# iguais → deploy confirmado. Se vier "unknown"/source:none → env não exposta
# no runtime, configurar SOURCE_COMMIT no painel do Coolify.
```

## Referências de memória

- [[coolify-migration]] — deploy Coolify, auto-deploy na main, "CI verde ≠ no ar".
- [[calls-connected-metric-unified]] — a correção de conexão (Opção B) cujo deploy este endpoint confirmou.
