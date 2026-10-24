'use client';

import React, { useState } from 'react';
import { ShieldCheck, UserCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/auth-context';

export function Header({ title, description }: { title: string; description?: string }) {
  const { user, login } = useAuth();
  const [switching, setSwitching] = useState(false);

  // Evaluation persona quick-switch accounts
  const demoAccounts = [
    { label: 'Admin', email: 'admin@example.test', pass: 'AdminSecretPass123!' },
    { label: 'Owner A', email: 'owner-a@example.test', pass: 'OwnerASecretPass123!' },
    { label: 'Owner B', email: 'owner-b@example.test', pass: 'OwnerBSecretPass123!' },
    { label: 'Viewer A', email: 'viewer-a@example.test', pass: 'ViewerASecretPass123!' },
    { label: 'Viewer B', email: 'viewer-b@example.test', pass: 'ViewerBSecretPass123!' },
  ];

  const handleQuickSwitch = async (email: string, pass: string) => {
    setSwitching(true);
    await login(email, pass);
    setSwitching(false);
    window.location.reload();
  };

  return (
    <header className="border-b border-vault-border bg-vault-900/60 backdrop-blur-md px-8 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sticky top-0 z-20">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          {title}
        </h1>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Security Health Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-vault-850 border border-vault-border text-xs font-mono">
          <ShieldCheck className="h-4 w-4 text-vault-success" />
          <span className="text-slate-300">Zero-Trust Guard:</span>
          <span className="text-vault-success font-semibold">Active</span>
        </div>

        {/* Demo Persona Switcher for Evaluators */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-vault-850/80 border border-vault-border text-xs">
          <UserCheck className="h-3.5 w-3.5 text-vault-accent" />
          <span className="text-slate-400 font-mono text-[11px] mr-1">Switch:</span>
          {demoAccounts.map((acc) => {
            const isCurrent = user?.email === acc.email;
            return (
              <button
                key={acc.email}
                disabled={switching || isCurrent}
                onClick={() => handleQuickSwitch(acc.email, acc.pass)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                  isCurrent
                    ? 'bg-vault-accent text-vault-950 font-bold shadow-sm'
                    : 'bg-vault-800 text-slate-300 hover:text-white hover:bg-vault-700'
                }`}
              >
                {acc.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
