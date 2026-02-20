'use client';

import { useState, useTransition } from 'react';

import { Loader2, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { changePassword, updateProfile } from '../actions/update-profile';

interface UserProfileSettingsProps {
  initialName: string;
  email: string;
}

export function UserProfileSettings({ initialName, email }: UserProfileSettingsProps) {
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingProfile, startProfileTransition] = useTransition();
  const [isSavingPassword, startPasswordTransition] = useTransition();

  const handleSaveProfile = () => {
    startProfileTransition(async () => {
      const result = await updateProfile({ fullName: name });
      if (result.success) {
        toast.success('Perfil atualizado');
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    startPasswordTransition(async () => {
      const result = await changePassword({
        currentPassword,
        newPassword,
      });
      if (result.success) {
        toast.success('Senha alterada com sucesso');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Profile Section */}
      <section>
        <h2 className="text-lg font-semibold">Perfil</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Atualize suas informações pessoais.
        </p>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} readOnly className="bg-[var(--muted)]" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
            />
          </div>

          <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
            {isSavingProfile ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Perfil
          </Button>
        </div>
      </section>

      {/* Separator */}
      <div className="border-t border-[var(--border)]" />

      {/* Password Section */}
      <section>
        <h2 className="text-lg font-semibold">Alterar Senha</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Mantenha sua conta segura atualizando sua senha periodicamente.
        </p>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Senha Atual</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {isSavingPassword ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Alterar Senha
          </Button>
        </div>
      </section>
    </div>
  );
}
