'use client';

import { ReactNode } from 'react';
import NavbarWrapper from './NavbarWrapper';
import { KeyboardAware } from './KeyboardAware';
import { PwaSetup } from './PwaSetup';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <KeyboardAware />
      <PwaSetup />
      <NavbarWrapper />
      <main className="pt-16">
        {children}
      </main>
    </div>
  );
} 