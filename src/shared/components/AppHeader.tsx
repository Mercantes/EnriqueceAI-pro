'use client';

import { UserMenu } from '@/features/auth/components/UserMenu';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';

import { MobileMenuTrigger } from './AppSidebar';
import { ThemeToggle } from './ThemeToggle';

export function AppHeader() {
  return (
    <header className="flex h-14 items-center gap-4 border-b px-4">
      <MobileMenuTrigger />
      <div className="flex-1" />
      <ThemeToggle />
      <NotificationBell />
      <UserMenu />
    </header>
  );
}
