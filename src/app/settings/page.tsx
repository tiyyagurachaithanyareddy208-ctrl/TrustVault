'use client';

import React from 'react';
import {
  Settings,
  Shield,
  KeyRound,
  Lock,
  LogOut,
  User,
  Server,
  Layers,
  Database,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/components/auth-context';

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <AppLayout
      title="Security & Account Settings"
      description="Cryptographic parameters, identity credentials, and session governance"
    >
      <div className="max-w-4xl space-y-6">
        {/* User Identity Profile */}
        <div className="bg-vault-900 border border-vault-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5 border-b border-vault-border pb-4">
            <div className="h-10 w-10 rounded-xl bg-vault-800 border border-vault-border flex items-center justify-center text-vault-accent">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Active Identity Profile</h2>
              <p className="text-xs text-slate-400">Current authenticated server-side session credentials</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3.5 bg-vault-950 rounded-xl border border-vault-border">
              <span className="text-slate-500 block text-[10px] uppercase">Full Name</span>
              <span className="text-white font-semibold text-sm mt-0.5 block">{user?.name}</span>
            </div>

            <div className="p-3.5 bg-vault-950 rounded-xl border border-vault-border">
              <span className="text-slate-500 block text-[10px] uppercase">Email Identity</span>
              <span className="text-white font-semibold text-sm mt-0.5 block">{user?.email}</span>
            </div>

            <div className="p-3.5 bg-vault-950 rounded-xl border border-vault-border">
              <span className="text-slate-500 block text-[10px] uppercase">Organizational Role</span>
              <span className="text-vault-accent font-semibold text-sm mt-0.5 block">{user?.role}</span>
            </div>

            <div className="p-3.5 bg-vault-950 rounded-xl border border-vault-border">
              <span className="text-slate-500 block text-[10px] uppercase">Account Status</span>
              <span className="text-vault-success font-semibold text-sm mt-0.5 block flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-vault-success animate-pulse" />
                Active & Verified
              </span>
            </div>
          </div>
        </div>

        {/* Cryptographic Vault Parameters */}
        <div className="bg-vault-900 border border-vault-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5 border-b border-vault-border pb-4">
            <div className="h-10 w-10 rounded-xl bg-vault-800 border border-vault-border flex items-center justify-center text-vault-accent">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Security & Cryptographic Standards</h2>
              <p className="text-xs text-slate-400">Zero-trust controls configured on this TrustVault deployment</p>
            </div>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 bg-vault-950 rounded-xl border border-vault-border flex items-center justify-between">
              <div>
                <span className="text-white font-bold block">Password KDF</span>
                <span className="text-slate-400 text-[11px]">Argon2id (m=65536, t=3, p=4)</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-vault-800 text-vault-success font-semibold text-[10px]">
                Active
              </span>
            </div>

            <div className="p-3 bg-vault-950 rounded-xl border border-vault-border flex items-center justify-between">
              <div>
                <span className="text-white font-bold block">Audit Trail Integrity</span>
                <span className="text-slate-400 text-[11px]">SHA-256 Sequential Cryptographic Hash Chain</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-vault-800 text-vault-success font-semibold text-[10px]">
                Active
              </span>
            </div>

            <div className="p-3 bg-vault-950 rounded-xl border border-vault-border flex items-center justify-between">
              <div>
                <span className="text-white font-bold block">Private Storage Driver</span>
                <span className="text-slate-400 text-[11px]">Isolated Vault Filesystem (Outside Web Root, UUID keys)</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-vault-800 text-vault-success font-semibold text-[10px]">
                Enforced
              </span>
            </div>

            <div className="p-3 bg-vault-950 rounded-xl border border-vault-border flex items-center justify-between">
              <div>
                <span className="text-white font-bold block">Session Policy</span>
                <span className="text-slate-400 text-[11px]">HTTP-Only, SameSite=Lax, Database-validated tokens (12h TTL)</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-vault-800 text-vault-success font-semibold text-[10px]">
                Enforced
              </span>
            </div>
          </div>
        </div>

        {/* Terminate Session */}
        <div className="bg-vault-900 border border-vault-border rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Sign Out of TrustVault</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Invalidates current session token in database and purges session cookie.
            </p>
          </div>
          <button
            onClick={() => logout()}
            className="px-4 py-2.5 rounded-xl bg-vault-danger/10 hover:bg-vault-danger/20 border border-vault-danger/30 text-vault-danger font-semibold text-xs flex items-center gap-2 transition shrink-0"
          >
            <LogOut className="h-4 w-4" />
            <span>Terminate Session</span>
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
