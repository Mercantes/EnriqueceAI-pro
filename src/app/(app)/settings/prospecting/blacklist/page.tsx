import { requireManager } from '@/lib/auth/require-manager';

import { ComingSoonPlaceholder } from '@/features/settings-prospecting/components/ComingSoonPlaceholder';

export default async function BlacklistPage() {
  await requireManager();
  return <ComingSoonPlaceholder title="Blacklist de E-mails" />;
}
