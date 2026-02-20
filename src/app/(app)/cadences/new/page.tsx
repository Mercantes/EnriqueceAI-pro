import { requireAuth } from '@/lib/auth/require-auth';

import { fetchTemplates } from '@/features/templates/actions/fetch-templates';
import { CadenceBuilder } from '@/features/cadences/components/CadenceBuilder';

export default async function NewCadencePage() {
  await requireAuth();

  const result = await fetchTemplates({ per_page: 100 });
  const templates = result.success ? result.data.data : [];

  return <CadenceBuilder templates={templates} />;
}
