import { Upload } from 'lucide-react';

import { EmptyState } from '@/shared/components/EmptyState';

export function EmptyDashboard() {
  return (
    <EmptyState
      icon={Upload}
      title="Comece importando seus leads"
      description="Importe seus contatos para começar a criar cadências de engajamento e acompanhar métricas."
      action={{ label: 'Importar Leads', href: '/leads/import' }}
    />
  );
}
