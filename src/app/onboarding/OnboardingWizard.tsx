'use client';

import { useState, useTransition } from 'react';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { Building2, Loader2, Plug, Rocket, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { completeOnboarding } from '@/features/auth/actions/complete-onboarding';

const STEPS = [
  { title: 'Sua Empresa', icon: Building2, description: 'Vamos configurar sua organização' },
  { title: 'Equipe', icon: Users, description: 'Convide seus colegas depois' },
  { title: 'Pronto!', icon: Rocket, description: 'Tudo configurado' },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSaveOrg = () => {
    if (!orgName.trim()) {
      toast.error('Informe o nome da empresa');
      return;
    }

    startTransition(async () => {
      const result = await completeOnboarding({ orgName });
      if (result.success) {
        setStep(1);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleFinish = () => {
    router.push('/dashboard');
  };

  return (
    <div className="w-full max-w-lg">
      {/* Progress */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                i <= step
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
              }`}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 transition-colors ${
                  i < step ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        {/* Step 1: Org Name */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <Image src="/logos/logo-ea-red.png" alt="Enriquece AI" width={48} height={48} className="mx-auto rounded-full" />
              <h1 className="mt-4 text-2xl font-bold">Bem-vindo ao Enriquece AI!</h1>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Primeiro, como se chama sua empresa?
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgName">Nome da Empresa</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Ex: Minha Empresa Ltda"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveOrg()}
              />
            </div>

            <Button onClick={handleSaveOrg} disabled={isPending} className="w-full">
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Continuar
            </Button>
          </div>
        )}

        {/* Step 2: Team (informational) */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <Users className="mx-auto h-10 w-10 text-[var(--primary)]" />
              <h1 className="mt-4 text-2xl font-bold">Monte sua Equipe</h1>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Você pode convidar membros da equipe a qualquer momento em{' '}
                <strong>Configurações &gt; Usuários</strong>.
              </p>
            </div>

            <div className="rounded-md border border-[var(--border)] bg-[var(--muted)] p-4">
              <div className="flex items-start gap-3">
                <Plug className="mt-0.5 h-5 w-5 text-[var(--muted-foreground)]" />
                <div>
                  <p className="text-sm font-medium">Dica: conecte suas integrações</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Conecte Gmail, WhatsApp e CRM em{' '}
                    <strong>Configurações &gt; Integrações</strong> para aproveitar ao máximo a plataforma.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                Voltar
              </Button>
              <Button onClick={() => setStep(2)} className="flex-1">
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <Rocket className="mx-auto h-10 w-10 text-[var(--primary)]" />
              <h1 className="mt-4 text-2xl font-bold">Tudo Pronto!</h1>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Sua organização está configurada. Comece importando seus leads ou criando uma cadência.
              </p>
            </div>

            <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
              <p>Seus primeiros passos:</p>
              <ol className="ml-4 list-decimal space-y-1">
                <li>Importe seus leads via CSV</li>
                <li>Crie sua primeira cadência de prospecção</li>
                <li>Conecte seu email (Gmail) para envios</li>
              </ol>
            </div>

            <Button onClick={handleFinish} className="w-full">
              Ir para o Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
