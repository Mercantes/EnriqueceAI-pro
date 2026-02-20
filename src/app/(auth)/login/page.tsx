import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import { LoginForm } from '@/features/auth/components/LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect('/dashboard');

  const { error } = await searchParams;
  const errorMessage =
    error === 'auth' ? 'Falha na autenticação. Tente novamente.' : undefined;

  return <LoginForm error={errorMessage} />;
}
