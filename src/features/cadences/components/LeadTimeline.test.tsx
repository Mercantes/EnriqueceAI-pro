import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { TimelineEntry } from '../cadences.contract';
import { LeadTimeline } from './LeadTimeline';

function createEntry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: 'int-1',
    type: 'sent',
    channel: 'email',
    message_content: 'Olá, tudo bem?',
    ai_generated: false,
    created_at: '2026-02-15T10:00:00Z',
    ...overrides,
  };
}

describe('LeadTimeline', () => {
  it('should show empty state when no entries', () => {
    render(<LeadTimeline entries={[]} />);
    expect(screen.getByText('Nenhuma interação registrada ainda.')).toBeInTheDocument();
  });

  it('should show timeline header', () => {
    render(<LeadTimeline entries={[createEntry()]} />);
    expect(screen.getByText('Timeline de Atividades')).toBeInTheDocument();
  });

  it('should show sent interaction', () => {
    render(<LeadTimeline entries={[createEntry({ type: 'sent' })]} />);
    expect(screen.getByText('Enviado')).toBeInTheDocument();
  });

  it('should show delivered interaction', () => {
    render(<LeadTimeline entries={[createEntry({ type: 'delivered' })]} />);
    expect(screen.getByText('Entregue')).toBeInTheDocument();
  });

  it('should show opened interaction', () => {
    render(<LeadTimeline entries={[createEntry({ type: 'opened' })]} />);
    expect(screen.getByText('Aberto')).toBeInTheDocument();
  });

  it('should show replied interaction', () => {
    render(<LeadTimeline entries={[createEntry({ type: 'replied' })]} />);
    expect(screen.getByText('Respondeu')).toBeInTheDocument();
  });

  it('should show channel badge for email', () => {
    render(<LeadTimeline entries={[createEntry({ channel: 'email' })]} />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('should show channel badge for whatsapp', () => {
    render(<LeadTimeline entries={[createEntry({ channel: 'whatsapp' })]} />);
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  });

  it('should show message content', () => {
    render(<LeadTimeline entries={[createEntry({ message_content: 'Olá, tudo bem?' })]} />);
    expect(screen.getByText('Olá, tudo bem?')).toBeInTheDocument();
  });

  it('should show cadence name and step', () => {
    render(
      <LeadTimeline
        entries={[createEntry({ cadence_name: 'Follow Up', step_order: 2 })]}
      />,
    );
    expect(screen.getByText(/Follow Up/)).toBeInTheDocument();
    expect(screen.getByText(/Passo 2/)).toBeInTheDocument();
  });

  it('should show AI badge when ai_generated', () => {
    render(<LeadTimeline entries={[createEntry({ ai_generated: true })]} />);
    expect(screen.getByText('IA')).toBeInTheDocument();
  });

  it('should render multiple entries', () => {
    const entries = [
      createEntry({ id: 'int-1', type: 'sent' }),
      createEntry({ id: 'int-2', type: 'opened' }),
      createEntry({ id: 'int-3', type: 'replied' }),
    ];
    render(<LeadTimeline entries={entries} />);
    expect(screen.getByText('Enviado')).toBeInTheDocument();
    expect(screen.getByText('Aberto')).toBeInTheDocument();
    expect(screen.getByText('Respondeu')).toBeInTheDocument();
  });
});
