'use client';

import React from 'react';
import Link from 'next/navigation';
import { usePathname, useRouter } from 'next/navigation';
import {
  Shield,
  FileText,
  Activity,
  Users,
  Settings,
  LogOut,
  Lock,
  Layers,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: Activity,
    },
    {
      label: 'Document Library',
      href: '/documents',
      icon: FileText,
    },
    {
      label: 'Audit Trail',
      href: '/audit',
      icon: Layers,
    },
    ...(user?.role === 'ADMINISTRATOR'
      ? [
          {
            label: 'Admin Control',
            href: '/admin',
            icon: Users,
            badge: 'Admin',
          },
        ]
      : []),
    {
      label: 'Security Settings',
      href: '/settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-vault-900 border-r border-vault-border flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Platform Branding */}
      <div className="p-6 border-b border-vault-border flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-vault-800 border border-vault-accent/30 flex items-center justify-center text-vault-accent shadow-[0_0_15px_rgba(0,229,255,0.15)]">
          <Shield className="h-6 w-6 text-vault-accent" />
        </div>
        <div>
          <span className="font-bold text-lg tracking-wider text-white">TrustVault</span>
          <div className="flex items-center gap-1.5 text-[10px] text-vault-accent font-mono uppercase tracking-widest">
            <Lock className="h-2.5 w-2.5" />
            Zero-Trust Vault
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-3 mb-2">
          Platform
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all text-left',
                isActive
                  ? 'bg-vault-800 text-vault-accent border border-vault-border shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-vault-850 hover:text-white'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn('h-4 w-4', isActive ? 'text-vault-accent' : 'text-slate-400')} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-vault-accent/10 border border-vault-accent/30 text-vault-accent">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Information & Role Card */}
      {user && (
        <div className="p-4 border-t border-vault-border bg-vault-950/60">
          <div className="flex items-center justify-between mb-2">
            <div className="truncate pr-2">
              <div className="text-sm font-semibold text-white truncate">{user.name}</div>
              <div className="text-xs text-slate-400 font-mono truncate">{user.email}</div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-vault-danger hover:bg-vault-850 rounded-lg transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-vault-border/60 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-mono text-slate-300">
              <KeyRound className="h-3 w-3 text-vault-accent" />
              {user.role}
            </span>
            <span className="flex items-center gap-1 text-vault-success font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-vault-success animate-pulse" />
              Active
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
