import { requireManager } from '@/lib/auth/require-manager';

import { ComingSoonPlaceholder } from '@/features/settings-prospecting/components/ComingSoonPlaceholder';

export default async function AccessPage() {
  await requireManager();
  return <ComingSoonPlaceholder title="Acesso aos Leads" />;
}
