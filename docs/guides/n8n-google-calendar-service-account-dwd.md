# n8n + Google Calendar via Service Account (Domain-Wide Delegation)

Guia para o reagendamento de reunião no n8n acessar a agenda de **qualquer closer**
sem OAuth por pessoa e sem compartilhamento manual, usando uma **Service Account (SA)**
com **Domain-Wide Delegation (DWD)** que impersona cada closer dinamicamente.

## Contexto

- Fluxo: webhook de reunião → n8n. Workflow de reagendamento **"WhatsApp - Respostas de Reuniao"** (`CYeIDuEtSYgIatE7`) em `n8n.v4companyamaral.com`.
- Hoje o nó **"Mover Evento na Agenda"** é o nó **nativo** do Google Calendar (`googleCalendarOAuth2Api`): usa **uma** conta Google e só move o evento se a agenda do closer estiver **compartilhada** com essa conta (nível "Fazer alterações nos eventos"). Sem isso → **403 Forbidden**.
- Alternativa atual em produção (Opção A): cada closer compartilha a agenda com a conta do n8n. Simples para poucos closers; ver o checklist no handoff `docs/sessions/2026-08/2026-08-09-webhook-reuniao-n8n.md`.
- **Opção C (este guia):** SA + DWD impersonando cada closer → sem compartilhamento manual, escala automática para closers novos.

> ⚠️ O nó **nativo** do Calendar no n8n só faz **OAuth2** (não Service Account), e o usuário impersonado de uma SA é **fixo por credencial**. Como o reagendamento precisa mirar o closer certo **por execução** (o e-mail vem em `$json.calendar_id`), a implementação limpa é via **HTTP Request + JWT montado por item**.

---

## Parte 1 — Google Cloud (criar a Service Account)

1. [console.cloud.google.com](https://console.cloud.google.com) → crie/selecione um projeto (ex.: `v4-n8n-calendar`).
2. **APIs & Services → Library → Google Calendar API → Enable**.
3. **IAM & Admin → Service Accounts → Create Service Account**:
   - Nome: `n8n-calendar` → Create (não precisa de role de projeto — DWD é no nível do Workspace, não IAM).
4. Abra a SA → aba **Details** → anote o **Client ID / Unique ID** (numérico, ~21 dígitos) e o **e-mail da SA** (`...@...iam.gserviceaccount.com`).
5. Aba **Keys → Add Key → Create new key → JSON** → baixe. O arquivo tem `client_email` e `private_key` (guarde como segredo).

## Parte 2 — Admin do Workspace (autorizar a delegação)

> Precisa de **admin do Google Workspace**.

6. [admin.google.com](https://admin.google.com) → **Security → Access and data control → API controls → Domain-wide delegation → Add new**.
7. **Client ID** = o Client ID numérico da SA (passo 4).
8. **OAuth scopes** (exato): `https://www.googleapis.com/auth/calendar`
9. **Authorize.** A SA passa a poder impersonar qualquer usuário `@v4company.com` para Calendar.

## Parte 3 — n8n (impersonação dinâmica por closer, via HTTP + JWT)

Para cada reagendamento, montar um token **impersonando o closer daquele evento** (`sub = calendar_id`). Encadeamento que **substitui** o nó "Mover Evento na Agenda":

**(a) Code — montar o JWT (header + claims)**
```js
const now = Math.floor(Date.now() / 1000);
const sub = $json.calendar_id; // e-mail do closer (já vem do payload)
const header = { alg: 'RS256', typ: 'JWT' };
const claims = {
  iss: 'n8n-calendar@SEU-PROJETO.iam.gserviceaccount.com', // client_email da SA
  sub,                                                       // ⭐ impersona o closer
  scope: 'https://www.googleapis.com/auth/calendar',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600
};
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const unsigned = b64(header) + '.' + b64(claims);
return [{ json: { ...$json, unsigned, sub } }];
```

**(b) Crypto node — assinar**: operação **Sign**, algoritmo **RSA-SHA256**, valor `{{ $json.unsigned }}`, chave privada = `private_key` da SA (via **credencial/segredo do n8n**, nunca inline), saída **base64url**. Depois: `assertion = unsigned + '.' + assinatura`.

**(c) HTTP Request — trocar o JWT por access_token**
- `POST https://oauth2.googleapis.com/token`
- Body (form-urlencoded): `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` + `assertion={{ $json.assertion }}`
- Resposta → `access_token`.

**(d) HTTP Request — mover o evento** (substitui o nó nativo)
- `PATCH https://www.googleapis.com/calendar/v3/calendars/{{ $json.calendar_id }}/events/{{ $json.event_id }}?sendUpdates=all`
- Header: `Authorization: Bearer {{ access_token }}`
- Body JSON: `{ "start": { "dateTime": "{{ $json.inicio_iso }}" }, "end": { "dateTime": "{{ $json.fim_iso }}" } }`

O mesmo `access_token` (por closer) também serve para o **"Buscar Ocupados"** (freebusy) — troque para HTTP se quiser eliminar 100% o compartilhamento.

### Plugar no workflow atual
- `Preparar Novo Horario` já entrega `calendar_id`, `event_id`, `inicio_iso`, `fim_iso`.
- Insira os nós (a)→(d) **no lugar** do "Mover Evento na Agenda", mantendo as saídas que alimentam "Gravar Novo Horario" e "Responder Reagendado".
- Em erro (PATCH != 2xx), siga para o caminho de falha atual ("Responder Falha no Reagendamento" / avisar SDR).

## Validação
- Reagendar um closer que **nunca compartilhou** a agenda deve funcionar (a SA impersona ele).
- **403** persistente → revise: escopo no Admin (passo 8), Client ID correto, Calendar API habilitada, `sub` sendo e-mail real do domínio.

## Segurança
- A `private_key` da SA é **credencial de alto poder** (acessa a agenda de todo o domínio): só via credencial/segredo do n8n, **jamais** no repo ou inline no workflow.
- Escopo **mínimo** (`/auth/calendar`; se um dia só mover eventos, `/auth/calendar.events`).
- **Revogação:** remover a linha da Domain-wide delegation no Admin corta o acesso imediatamente.

## Trade-off
Para **3 closers**, a Opção A (compartilhar) é mais rápida e não exige admin nem HTTP+JWT. A Opção C compensa quando o número de closers cresce ou não se quer depender de cada um clicar em "compartilhar".

---

## Prompt pronto para executar com o Claude

Cole numa sessão do Claude com acesso ao MCP do n8n:

```text
CONTEXTO
Trabalho no EnriqueceAI (V4 Amaral). Temos um fluxo de reagendamento de reunião no
n8n (instância n8n.v4companyamaral.com), workflow "WhatsApp - Respostas de Reuniao",
ID CYeIDuEtSYgIatE7. Hoje o nó "Mover Evento na Agenda" é o nó NATIVO do Google
Calendar (googleCalendarOAuth2Api), que usa UMA conta Google e só consegue mover o
evento se a agenda do closer estiver compartilhada com essa conta ("Fazer alterações
nos eventos") — senão dá 403 Forbidden. Quero eliminar essa dependência de
compartilhamento manual migrando para uma Service Account com Domain-Wide Delegation
(DWD) que IMPERSONA cada closer dinamicamente.

O nó nativo do Calendar no n8n só faz OAuth2 e o "usuário impersonado" de uma Service
Account é fixo por credencial — como o reagendamento precisa mirar o closer certo por
execução (o e-mail dele vem em $json.calendar_id), a implementação tem que ser via
HTTP Request + JWT montado por item.

O que o fluxo já entrega antes do move (nó "Preparar Novo Horario", saída $json):
  calendar_id  → e-mail Google do closer (o subject a impersonar)
  event_id     → id cru do evento no Google Calendar
  inicio_iso, fim_iso → novo horário (ISO UTC)
  telefone, nome, link_reuniao, data_br, hora_br

PRÉ-REQUISITOS QUE EU (humano) VOU PROVIDENCIAR — não tente fazer no Google Cloud/Admin:
  1. Service Account criada no Google Cloud, com a Google Calendar API habilitada.
  2. Domain-Wide Delegation autorizada no Admin do Workspace para o Client ID da SA,
     com o escopo https://www.googleapis.com/auth/calendar
  3. Vou cadastrar no n8n uma credencial/segredo com a private_key da SA (NUNCA
     hardcodar a chave no JSON do workflow). Me diga exatamente que credencial/segredo
     criar e como referenciá-la nos nós.
  Vou te passar: client_email da SA (ex.: n8n-calendar@projeto.iam.gserviceaccount.com).

TAREFA
1. Leia o workflow CYeIDuEtSYgIatE7 (get_workflow_details) e mapeie o trecho do
   reagendamento (Escolheu Horario? → Buscar Dados da Reuniao → Preparar Novo Horario
   → Dados da Reuniao OK? → Mover Evento na Agenda → Gravar Novo Horario → Responder
   Reagendado). NÃO altere nada antes de me mostrar o plano.
2. Proponha o encadeamento que SUBSTITUI o "Mover Evento na Agenda" por:
   (a) um nó que monta o JWT (header {alg:RS256,typ:JWT} + claims {iss:client_email,
       sub:$json.calendar_id, scope:calendar, aud:https://oauth2.googleapis.com/token,
       iat, exp:iat+3600}), base64url;
   (b) um nó Crypto (Sign, RSA-SHA256, private key da SA via credencial/segredo, saída
       base64url) e concatenação assertion = unsigned + "." + assinatura;
   (c) HTTP Request POST https://oauth2.googleapis.com/token
       (grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer & assertion=<jwt>) →
       pega access_token;
   (d) HTTP Request PATCH
       https://www.googleapis.com/calendar/v3/calendars/{{calendar_id}}/events/{{event_id}}?sendUpdates=all
       Header Authorization: Bearer <access_token>
       Body: { "start": { "dateTime": "<inicio_iso>" }, "end": { "dateTime": "<fim_iso>" } }
   Mantenha as saídas para "Gravar Novo Horario" e "Responder Reagendado" funcionando
   (mesmos campos que hoje).
3. Trate erros: se o PATCH voltar != 2xx, seguir para o caminho de falha atual
   ("Responder Falha no Reagendamento" / avisar SDR), como já acontece.
4. Depois que eu aprovar o plano, aplique via update_workflow em UMA operação atômica.
   É um workflow ATIVO que fala com cliente — não faça nada destrutivo, não dispare
   execuções reais que mandem WhatsApp/movam eventos de clientes; se precisar testar,
   me proponha um teste controlado com o meu próprio número/agenda primeiro.
5. Me diga como validar (impersonar um closer que NUNCA compartilhou a agenda deve
   funcionar; 403 = revisar escopo/Client ID no Admin ou Calendar API).

REGRAS
- A private_key da SA é segredo de alto poder (acessa a agenda de todo o domínio):
  só via credencial/segredo do n8n, jamais inline no workflow.
- Escopo mínimo (/auth/calendar). Explique como revogar (remover a linha da DWD no Admin).
- Não commite nada nem mude infra fora do n8n sem eu pedir.
```
