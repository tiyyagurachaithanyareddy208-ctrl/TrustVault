'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Eye, EyeOff, AlertCircle, ArrowRight, KeyRound, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await login(email, password);
    setLoading(false);

    if (res.success) {
      router.push('/dashboard');
    } else {
      setError(res.error || 'Invalid email or password.');
    }
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-vault-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background radial accent glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-vault-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-vault-900 border border-vault-accent/40 items-center justify-center text-vault-accent shadow-[0_0_25px_rgba(0,229,255,0.2)] mb-3">
            <Shield className="h-8 w-8 text-vault-accent" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">TrustVault</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-widest">
            Cryptographic Zero-Trust Document Vault
          </p>
        </div>

        {/* Authentication Card */}
        <div className="bg-vault-900/90 border border-vault-border rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between pb-5 mb-6 border-b border-vault-border">
            <div>
              <h2 className="text-base font-semibold text-white">Sign In</h2>
              <p className="text-xs text-slate-400">Authenticate with encrypted credentials</p>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-vault-accent/10 border border-vault-accent/20 text-[11px] font-mono text-vault-accent">
              <Lock className="h-3 w-3" />
              Argon2id
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-vault-danger/10 border border-vault-danger/30 text-xs text-vault-danger flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Organizational Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-vault-950 border border-vault-border focus:border-vault-accent focus:ring-1 focus:ring-vault-accent text-sm text-white placeholder-slate-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-vault-950 border border-vault-border focus:border-vault-accent focus:ring-1 focus:ring-vault-accent text-sm text-white placeholder-slate-500 outline-none transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-vault-accent text-vault-950 font-bold text-sm hover:brightness-110 active:brightness-95 transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.25)] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-vault-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Securely</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick-Fill Demonstration Personas */}
          <div className="mt-8 pt-6 border-t border-vault-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase">
                Demo Security Personas
              </span>
              <span className="text-[10px] text-vault-accent font-mono">1-Click Autofill</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@example.test', 'AdminSecretPass123!')}
                className="p-2 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-left transition flex items-center gap-2"
              >
                <KeyRound className="h-3.5 w-3.5 text-vault-accent shrink-0" />
                <div className="truncate">
                  <div className="text-white font-medium text-[11px]">Administrator</div>
                  <div className="text-[10px] text-slate-400 truncate">admin@example.test</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('owner-a@example.test', 'OwnerASecretPass123!')}
                className="p-2 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-left transition flex items-center gap-2"
              >
                <KeyRound className="h-3.5 w-3.5 text-vault-success shrink-0" />
                <div className="truncate">
                  <div className="text-white font-medium text-[11px]">Owner A</div>
                  <div className="text-[10px] text-slate-400 truncate">owner-a@example.test</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('owner-b@example.test', 'OwnerBSecretPass123!')}
                className="p-2 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-left transition flex items-center gap-2"
              >
                <KeyRound className="h-3.5 w-3.5 text-vault-warning shrink-0" />
                <div className="truncate">
                  <div className="text-white font-medium text-[11px]">Owner B</div>
                  <div className="text-[10px] text-slate-400 truncate">owner-b@example.test</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('viewer-a@example.test', 'ViewerASecretPass123!')}
                className="p-2 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-left transition flex items-center gap-2"
              >
                <KeyRound className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                <div className="truncate">
                  <div className="text-white font-medium text-[11px]">Viewer A</div>
                  <div className="text-[10px] text-slate-400 truncate">viewer-a@example.test</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Security Assurance Footer */}
        <div className="text-center mt-6 text-xs text-slate-400 flex items-center justify-center gap-2 font-mono">
          <ShieldAlert className="h-3.5 w-3.5 text-vault-accent" />
          <span>Server-Side Authorization Enforced On Every Request</span>
        </div>
      </div>
    </div>
  );
}
