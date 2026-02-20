# Requirements

## Functional

- **FR1:** O sistema deve permitir importação de leads em massa via arquivo CSV/planilha contendo CNPJs
- **FR2:** O sistema deve enriquecer automaticamente leads importados via CNPJ, retornando dados firmográficos (razão social, nome fantasia, endereço, porte, CNAE, situação cadastral) e dados de contato (email, telefone, sócios, faturamento estimado) através de integração com Lemit ou provedor similar
- **FR3:** O sistema deve exibir um dashboard de leads com visualização dos dados enriquecidos, filtros por porte/segmento/localização e métricas de importação
- **FR4:** O sistema deve permitir criação de cadências lineares com sequência fixa de passos configuráveis (canal, conteúdo, intervalo entre passos)
- **FR5:** O sistema deve enviar emails automatizados via integração com Gmail/Google Workspace (OAuth2)
- **FR6:** O sistema deve enviar mensagens automatizadas via integração com WhatsApp Business API
- **FR7:** O sistema deve gerar mensagens personalizadas com IA (email e WhatsApp) baseadas no perfil enriquecido do lead
- **FR8:** O sistema deve integrar com CRMs (HubSpot, Pipedrive, RD Station CRM) para sincronização bidirecional de leads e atividades
- **FR9:** O sistema deve integrar com Google Calendar para agendamento de reuniões diretamente a partir da cadência
- **FR10:** O sistema deve fornecer autenticação e gerenciamento de usuários com suporte a múltiplos membros por conta (time de SDRs)
- **FR11:** O sistema deve permitir gestão de templates de mensagens (email e WhatsApp) com variáveis dinâmicas do lead
- **FR12:** O sistema deve registrar histórico completo de interações por lead (emails enviados, WhatsApp, aberturas, cliques, respostas)
- **FR13:** O sistema deve exibir métricas de performance por cadência (taxa de abertura, resposta, conversão, bounce)

## Non-Functional

- **NFR1:** A plataforma deve ser construída com Next.js + Supabase, utilizando o tech preset nextjs-react como base
- **NFR2:** O tempo de enriquecimento por CNPJ deve ser inferior a 5 segundos por lead individualmente, com processamento em batch para importações em massa
- **NFR3:** A plataforma deve suportar até 10.000 leads ativos por conta no plano mais alto sem degradação de performance
- **NFR4:** A interface deve ser web responsive, priorizando desktop mas funcional em dispositivos móveis
- **NFR5:** A plataforma deve seguir padrões de segurança para dados sensíveis (LGPD compliance), com criptografia de dados em repouso e em trânsito
- **NFR6:** O sistema deve ter disponibilidade mínima de 99.5% (uptime)
- **NFR7:** As integrações com APIs externas (Lemit, WhatsApp, Gmail, CRMs) devem implementar retry com backoff exponencial e circuit breaker
- **NFR8:** O modelo de monetização deve incluir no plano base mínimo 3 usuários (SDRs) + 1 gerente, com cobrança adicional por cada novo usuário adicionado à conta
- **NFR9:** O sistema de enriquecimento deve suportar estratégia em camadas: dados gratuitos da Receita Federal (CNPJ.ws/ReceitaWS) para plano Starter, dados de contato via Lemit para plano Pro+
- **NFR10:** Os custos de WhatsApp Business API (~R$0,35/msg marketing) devem ser gerenciados via sistema de créditos incluídos por plano, com cobrança por excedente
