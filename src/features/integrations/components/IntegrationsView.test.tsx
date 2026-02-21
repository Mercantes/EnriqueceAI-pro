import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Api4ComConnectionSafe, CalendarConnectionSafe, CrmConnectionSafe, GmailConnectionSafe, WhatsAppConnectionSafe } from '../types';
import { IntegrationsView } from './IntegrationsView';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock('../actions/manage-gmail', () => ({
  getGmailAuthUrl: vi.fn(),
  disconnectGmail: vi.fn(),
}));

vi.mock('../actions/manage-crm', () => ({
  getCrmAuthUrl: vi.fn(),
  disconnectCrm: vi.fn(),
  triggerCrmSync: vi.fn(),
}));

vi.mock('../actions/manage-calendar', () => ({
  getCalendarAuthUrl: vi.fn(),
  disconnectCalendar: vi.fn(),
}));

const gmailConnected: GmailConnectionSafe = {
  id: 'gmail-1',
  email_address: 'user@gmail.com',
  status: 'connected',
  created_at: '2026-02-15T10:00:00Z',
  updated_at: '2026-02-15T10:00:00Z',
};

const whatsappConnected: WhatsAppConnectionSafe = {
  id: 'wa-1',
  phone_number_id: '123456789',
  business_account_id: 'BA-987',
  status: 'connected',
  created_at: '2026-02-15T10:00:00Z',
  updated_at: '2026-02-15T10:00:00Z',
};

const crmConnected: CrmConnectionSafe = {
  id: 'crm-1',
  crm_provider: 'hubspot',
  field_mapping: { leads: { nome_fantasia: 'company', email: 'email' } },
  status: 'connected',
  last_sync_at: '2026-02-19T10:00:00Z',
  created_at: '2026-02-15T10:00:00Z',
  updated_at: '2026-02-19T10:00:00Z',
};

const calendarConnected: CalendarConnectionSafe = {
  id: 'cal-1',
  calendar_email: 'user@gmail.com',
  status: 'connected',
  created_at: '2026-02-15T10:00:00Z',
  updated_at: '2026-02-15T10:00:00Z',
};

const api4comConnected: Api4ComConnectionSafe = {
  id: 'voip-1',
  ramal: '1014',
  status: 'connected',
  created_at: '2026-02-15T10:00:00Z',
  updated_at: '2026-02-15T10:00:00Z',
};

const defaultProps = { gmail: null, whatsapp: null, crm: null, calendar: null, api4com: null };

describe('IntegrationsView', () => {
  it('should render integrations header', () => {
    render(<IntegrationsView {...defaultProps} />);
    expect(screen.getByText('Integrações')).toBeInTheDocument();
  });

  it('should show unified Google card with description', () => {
    render(<IntegrationsView {...defaultProps} />);
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Email e Agenda')).toBeInTheDocument();
  });

  it('should show single "Conectar Google" button when not connected', () => {
    render(<IntegrationsView {...defaultProps} />);
    expect(screen.getByText('Conectar Google')).toBeInTheDocument();
    expect(screen.getByText(/enviar e ler emails.*agendar reuniões/)).toBeInTheDocument();
  });

  it('should show WhatsApp card', () => {
    render(<IntegrationsView {...defaultProps} />);
    expect(screen.getByText('WhatsApp Business')).toBeInTheDocument();
  });

  it('should show HubSpot card', () => {
    render(<IntegrationsView {...defaultProps} />);
    expect(screen.getAllByText('HubSpot').length).toBeGreaterThanOrEqual(1);
  });

  it('should show email address when Gmail connected', () => {
    render(<IntegrationsView {...defaultProps} gmail={gmailConnected} />);
    expect(screen.getByText('user@gmail.com')).toBeInTheDocument();
  });

  it('should show connected status for Google', () => {
    render(<IntegrationsView {...defaultProps} gmail={gmailConnected} />);
    expect(screen.getAllByText('Conectado').length).toBeGreaterThanOrEqual(1);
  });

  it('should show disconnect button when Google connected', () => {
    render(<IntegrationsView {...defaultProps} gmail={gmailConnected} />);
    expect(screen.getAllByText('Desconectar').length).toBeGreaterThanOrEqual(1);
  });

  it('should show WhatsApp phone number when connected', () => {
    render(<IntegrationsView {...defaultProps} whatsapp={whatsappConnected} />);
    expect(screen.getByText('Phone ID: 123456789')).toBeInTheDocument();
  });

  it('should show "Em breve" badge for WhatsApp when not connected', () => {
    render(<IntegrationsView {...defaultProps} />);
    expect(screen.getAllByText('Em breve').length).toBeGreaterThanOrEqual(1);
  });

  it('should show error status for Google when Gmail has error', () => {
    render(
      <IntegrationsView
        {...defaultProps}
        gmail={{ ...gmailConnected, status: 'error' }}
      />,
    );
    expect(screen.getByText('Erro')).toBeInTheDocument();
  });

  it('should show CRM provider options when CRM not connected', () => {
    render(<IntegrationsView {...defaultProps} />);
    expect(screen.getAllByText('HubSpot').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pipedrive')).toBeInTheDocument();
    expect(screen.getByText('RD Station')).toBeInTheDocument();
  });

  it('should show HubSpot details when CRM connected', () => {
    render(<IntegrationsView {...defaultProps} crm={crmConnected} />);
    expect(screen.getAllByText('HubSpot').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Último sync/)).toBeInTheDocument();
  });

  it('should show sync button when CRM connected', () => {
    render(<IntegrationsView {...defaultProps} crm={crmConnected} />);
    expect(screen.getByText('Sincronizar')).toBeInTheDocument();
  });

  it('should show syncing state when CRM is syncing', () => {
    render(
      <IntegrationsView
        {...defaultProps}
        crm={{ ...crmConnected, status: 'syncing' }}
      />,
    );
    expect(screen.getByText('Sincronizando')).toBeInTheDocument();
    expect(screen.getByText('Sincronizando...')).toBeInTheDocument();
  });

  it('should show disconnect button for CRM', () => {
    render(<IntegrationsView {...defaultProps} crm={crmConnected} />);
    expect(screen.getAllByText('Desconectar').length).toBeGreaterThanOrEqual(1);
  });

  it('should show "Nunca sincronizado" when CRM has no last_sync_at', () => {
    render(
      <IntegrationsView
        {...defaultProps}
        crm={{ ...crmConnected, last_sync_at: null }}
      />,
    );
    expect(screen.getByText('Nunca sincronizado')).toBeInTheDocument();
  });

  it('should show calendar details inside Google card when connected', () => {
    render(<IntegrationsView {...defaultProps} calendar={calendarConnected} />);
    expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    expect(screen.getAllByText('user@gmail.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Conectado').length).toBeGreaterThanOrEqual(1);
  });

  it('should show both Gmail and Calendar details when both connected', () => {
    render(
      <IntegrationsView
        {...defaultProps}
        gmail={gmailConnected}
        calendar={calendarConnected}
      />,
    );
    expect(screen.getByText('Gmail')).toBeInTheDocument();
    expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    expect(screen.getAllByText('user@gmail.com').length).toBeGreaterThanOrEqual(2);
  });

  it('should show error status for Google when calendar has error', () => {
    render(
      <IntegrationsView
        {...defaultProps}
        calendar={{ ...calendarConnected, status: 'error' }}
      />,
    );
    expect(screen.getAllByText('Erro').length).toBeGreaterThanOrEqual(1);
  });

  it('should show API4Com card with description', () => {
    render(<IntegrationsView {...defaultProps} />);
    expect(screen.getByText('API4Com')).toBeInTheDocument();
    expect(screen.getByText('Discador VoIP')).toBeInTheDocument();
  });

  it('should show "Em breve" badge for API4Com when not connected', () => {
    render(<IntegrationsView {...defaultProps} />);
    expect(screen.getAllByText('Em breve').length).toBeGreaterThanOrEqual(1);
  });

  it('should show ramal and Gerenciar button when API4Com connected', () => {
    render(<IntegrationsView {...defaultProps} api4com={api4comConnected} />);
    expect(screen.getByText('Ramal 1014')).toBeInTheDocument();
    expect(screen.getByText('Gerenciar')).toBeInTheDocument();
  });

  it('should show connected status for API4Com', () => {
    render(<IntegrationsView {...defaultProps} api4com={api4comConnected} />);
    expect(screen.getAllByText('Conectado').length).toBeGreaterThanOrEqual(1);
  });

  it('should show error status for API4Com when error', () => {
    render(
      <IntegrationsView
        {...defaultProps}
        api4com={{ ...api4comConnected, status: 'error' }}
      />,
    );
    expect(screen.getAllByText('Erro').length).toBeGreaterThanOrEqual(1);
  });
});
