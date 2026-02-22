import { redirect } from 'next/navigation';

import { requireManager } from '@/lib/auth/require-manager';

export default async function ProspectingSettingsPage() {
  await requireManager();
  redirect('/settings/prospecting/daily-goals');
}
