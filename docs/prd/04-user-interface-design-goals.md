# User Interface Design Goals

## Overall UX Vision

Uma interface limpa, moderna e orientada a ação — inspirada em ferramentas como HubSpot e Apollo.io, mas simplificada para o contexto brasileiro. O SDR deve conseguir executar sua rotina diária (verificar leads, iniciar cadências, revisar mensagens geradas pela IA) em no máximo 3 cliques a partir do dashboard principal. A estética deve transmitir profissionalismo e confiança, com foco em dados claros e ações rápidas.

## Key Interaction Paradigms

- **Dashboard-first:** O ponto de entrada é sempre o dashboard com visão consolidada de leads, cadências ativas e métricas
- **Bulk actions:** Importação em massa, enriquecimento em batch, iniciar cadências para múltiplos leads simultaneamente
- **Inline editing:** Editar mensagens geradas pela IA diretamente na tela de cadência, sem navegar para outra página
- **Notificações contextuais:** Alertas sobre respostas de leads, bounces e cadências finalizadas

## Core Screens and Views

1. **Dashboard Principal** — Métricas de performance, leads recentes, cadências ativas, ações pendentes
2. **Importação & Enriquecimento** — Upload CSV/CNPJ, progresso do enriquecimento, resultados em tabela
3. **Lista de Leads** — Tabela com filtros avançados (porte, segmento, localização, status na cadência), busca e bulk actions
4. **Perfil do Lead** — Dados enriquecidos, histórico de interações, cadência ativa, timeline de atividades
5. **Editor de Cadência** — Construtor visual de sequência linear (passos com canal, delay, conteúdo)
6. **Geração de Mensagem IA** — Preview da mensagem gerada, edição inline, seleção de tom/canal
7. **Templates** — Biblioteca de templates de email e WhatsApp com variáveis dinâmicas
8. **Integrações** — Configuração de CRM, Gmail, WhatsApp Business API, Google Calendar
9. **Configurações da Conta** — Gestão de usuários (SDRs + gerente), plano, billing
10. **Relatórios** — Métricas por cadência, por SDR, por período, taxa de conversão

## Accessibility: WCAG AA

Conformidade com WCAG AA — contraste adequado, navegação por teclado, labels em formulários. Essencial para credibilidade em vendas para mid-market.

## Branding

Ainda sem guia de marca definido. Recomendação: paleta moderna com azul/roxo como cor primária (transmite confiança e tecnologia), tipografia sans-serif clean (Inter ou similar), ícones lineares. A ser definido pelo stakeholder.

## Target Device and Platforms: Web Responsive

Web Responsive com prioridade desktop — SDRs trabalham primariamente em desktop/laptop. Layout responsivo para consultas rápidas em mobile (verificar notificações, responder leads urgentes), mas a experiência completa é desktop-first.
