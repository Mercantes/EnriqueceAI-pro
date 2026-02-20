import { describe, expect, it } from 'vitest';

import { buildPersonalizationPrompt, buildPrompt } from './prompts';
import type { LeadContext } from './types';

const mockLead: LeadContext = {
  nome_fantasia: 'TechCorp',
  razao_social: 'TechCorp Soluções LTDA',
  cnpj: '11222333000181',
  email: 'contato@techcorp.com',
  telefone: '(11) 99999-0000',
  porte: 'ME',
  cnae: '6201-5/01',
  situacao_cadastral: 'Ativa',
  faturamento_estimado: 500000,
  endereco: { cidade: 'São Paulo', uf: 'SP' },
  socios: [{ nome: 'João Silva', qualificacao: 'Sócio-Administrador' }],
};

describe('buildPrompt', () => {
  it('should include channel instructions for email', () => {
    const prompt = buildPrompt('email', 'professional', mockLead);
    expect(prompt).toContain('email profissional');
    expect(prompt).toContain('"subject"');
  });

  it('should include channel instructions for whatsapp', () => {
    const prompt = buildPrompt('whatsapp', 'direct', mockLead);
    expect(prompt).toContain('WhatsApp');
    expect(prompt).toContain('500 caracteres');
    expect(prompt).toContain('NÃO inclua campo "subject"');
  });

  it('should include tone instructions for professional', () => {
    const prompt = buildPrompt('email', 'professional', mockLead);
    expect(prompt).toContain('profissional e corporativo');
  });

  it('should include tone instructions for consultative', () => {
    const prompt = buildPrompt('email', 'consultative', mockLead);
    expect(prompt).toContain('consultivo');
  });

  it('should include tone instructions for direct', () => {
    const prompt = buildPrompt('email', 'direct', mockLead);
    expect(prompt).toContain('direto e objetivo');
  });

  it('should include tone instructions for friendly', () => {
    const prompt = buildPrompt('email', 'friendly', mockLead);
    expect(prompt).toContain('amigável');
  });

  it('should include lead context data', () => {
    const prompt = buildPrompt('email', 'professional', mockLead);
    expect(prompt).toContain('TechCorp');
    expect(prompt).toContain('TechCorp Soluções LTDA');
    expect(prompt).toContain('11222333000181');
    expect(prompt).toContain('ME');
    expect(prompt).toContain('6201-5/01');
    expect(prompt).toContain('São Paulo/SP');
    expect(prompt).toContain('João Silva');
    expect(prompt).toContain('R$ 500.000');
  });

  it('should include additional context when provided', () => {
    const prompt = buildPrompt('email', 'professional', mockLead, 'Oferecer desconto de 20%');
    expect(prompt).toContain('Contexto Adicional');
    expect(prompt).toContain('Oferecer desconto de 20%');
  });

  it('should request JSON format response', () => {
    const prompt = buildPrompt('email', 'professional', mockLead);
    expect(prompt).toContain('JSON válido');
  });

  it('should handle minimal lead data', () => {
    const minimalLead: LeadContext = {
      nome_fantasia: 'MinimalCorp',
      razao_social: null,
      cnpj: null,
      email: null,
      telefone: null,
      porte: null,
      cnae: null,
      situacao_cadastral: null,
      faturamento_estimado: null,
    };
    const prompt = buildPrompt('email', 'professional', minimalLead);
    expect(prompt).toContain('MinimalCorp');
    expect(prompt).not.toContain('CNPJ:');
  });
});

describe('buildPersonalizationPrompt', () => {
  it('should include template body', () => {
    const prompt = buildPersonalizationPrompt('email', 'Olá {{nome_fantasia}}!', mockLead);
    expect(prompt).toContain('Olá {{nome_fantasia}}!');
  });

  it('should include lead data', () => {
    const prompt = buildPersonalizationPrompt('email', 'Template base', mockLead);
    expect(prompt).toContain('TechCorp');
    expect(prompt).toContain('São Paulo/SP');
  });

  it('should request JSON format', () => {
    const prompt = buildPersonalizationPrompt('email', 'Template', mockLead);
    expect(prompt).toContain('JSON válido');
    expect(prompt).toContain('"body"');
  });

  it('should instruct to keep CTA and structure', () => {
    const prompt = buildPersonalizationPrompt('whatsapp', 'Template', mockLead);
    expect(prompt).toContain('CTA');
    expect(prompt).toContain('estrutura');
  });
});
