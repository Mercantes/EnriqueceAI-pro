import type { ChannelType } from '../types';

/**
 * System templates pre-created for new organizations.
 * These templates cannot be edited by users (is_system = true).
 */
export interface SystemTemplate {
  name: string;
  channel: ChannelType;
  subject: string | null;
  body: string;
  variables_used: string[];
}

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  // Email templates
  {
    name: 'Primeiro Contato - Email',
    channel: 'email',
    subject: 'Oportunidade para {{nome_fantasia}}',
    body: `Olá,

Meu nome é [Seu Nome] e trabalho na [Sua Empresa].

Estou entrando em contato porque identificamos que a {{nome_fantasia}} ({{razao_social}}) pode se beneficiar das nossas soluções.

Atuando no segmento de {{cnae}}, em {{cidade}}/{{uf}}, acredito que podemos ajudar vocês a [benefício principal].

Podemos agendar uma conversa rápida de 15 minutos esta semana?

Abraço,
[Seu Nome]`,
    variables_used: ['nome_fantasia', 'razao_social', 'cnae', 'cidade', 'uf'],
  },
  {
    name: 'Follow-up - Email',
    channel: 'email',
    subject: 'Re: Oportunidade para {{nome_fantasia}}',
    body: `Olá,

Enviei uma mensagem na semana passada sobre como podemos ajudar a {{nome_fantasia}}.

Sei que a rotina é corrida, então quero apenas reforçar: temos cases de empresas do porte {{porte}} que obtiveram resultados significativos com nossa solução.

Tem 10 minutos para uma conversa esta semana?

Abraço,
[Seu Nome]`,
    variables_used: ['nome_fantasia', 'porte'],
  },
  {
    name: 'Último Contato - Email',
    channel: 'email',
    subject: '{{nome_fantasia}} - Última tentativa de contato',
    body: `Olá,

Esta é minha última tentativa de contato com a {{nome_fantasia}}.

Caso não seja o momento certo, sem problemas. Fico à disposição para quando fizer sentido conversarmos.

Se preferir, pode responder este email indicando o melhor momento para retomar o contato.

Obrigado pela atenção,
[Seu Nome]`,
    variables_used: ['nome_fantasia'],
  },

  // WhatsApp templates
  {
    name: 'Primeiro Contato - WhatsApp',
    channel: 'whatsapp',
    subject: null,
    body: `Olá! 👋

Meu nome é [Seu Nome], da [Sua Empresa].

Identifiquei a {{nome_fantasia}} e acredito que podemos ajudar vocês em {{cidade}}/{{uf}}.

Posso explicar em 2 minutos como funciona?`,
    variables_used: ['nome_fantasia', 'cidade', 'uf'],
  },
  {
    name: 'Follow-up - WhatsApp',
    channel: 'whatsapp',
    subject: null,
    body: `Oi! Tudo bem?

Enviei uma mensagem sobre a {{nome_fantasia}} há alguns dias.

Temos ajudado empresas do porte {{porte}} a melhorar seus resultados. Gostaria de saber mais?`,
    variables_used: ['nome_fantasia', 'porte'],
  },
  {
    name: 'Último Contato - WhatsApp',
    channel: 'whatsapp',
    subject: null,
    body: `Olá!

Só passando para deixar meu contato disponível caso a {{nome_fantasia}} precise de apoio no futuro.

Fico à disposição! 😊`,
    variables_used: ['nome_fantasia'],
  },
];
