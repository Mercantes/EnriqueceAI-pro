import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

export default async function ForgotPasswordPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect('/dashboard');

  return <ForgotPasswordForm />;
}
