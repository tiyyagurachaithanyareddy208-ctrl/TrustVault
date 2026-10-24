'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { Sidebar } from './sidebar';
import { Header } from './header';

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  requireAdmin?: boolean;
}

export function AppLayout({ children, title, description, requireAdmin = false }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (requireAdmin && user.role !== 'ADMINISTRATOR') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, requireAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-vault-950 flex flex-col items-center justify-center text-slate-400">
        <div className="h-8 w-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mb-4" />
        <div className="font-mono text-xs tracking-widest uppercase">Validating Security Context...</div>
      </div>
    );
  }

  if (!user || (requireAdmin && user.role !== 'ADMINISTRATOR')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-vault-950 text-slate-100 flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <Header title={title} description={description} />
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
