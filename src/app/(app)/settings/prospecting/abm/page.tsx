import { requireManager } from '@/lib/auth/require-manager';

import { ComingSoonPlaceholder } from '@/features/settings-prospecting/components/ComingSoonPlaceholder';

export default async function AbmPage() {
  await requireManager();
  return <ComingSoonPlaceholder title="Vendas Baseadas em Contas" />;
}
