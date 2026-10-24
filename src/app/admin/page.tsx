'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Layers,
  Lock,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  UserX,
  UserCheck,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/components/auth-context';
import { formatDate, truncateHash } from '@/lib/utils';
import { ROLES } from '@/lib/constants';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/overview');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setOverview(data.data);
          setVerificationResult(data.data.chainStatus);
        }
      }
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const query = userSearch ? `?search=${encodeURIComponent(userSearch)}` : '';
      const res = await fetch(`/api/admin/users${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUsersList(data.data.users);
        }
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, [userSearch]);

  useEffect(() => {
    fetchOverview();
    fetchUsers();
  }, [fetchOverview, fetchUsers]);

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/admin/audit/verify');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setVerificationResult(data.data.verification);
        }
      }
    } catch (err) {
      console.error('Failed to verify chain:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleToggleUserStatus = async (targetUser: any) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !targetUser.isActive }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchUsers();
        fetchOverview();
      } else {
        setActionError(data.error?.message || 'Failed to update user status.');
      }
    } catch {
      setActionError('Network error while updating user.');
    }
  };

  const handleChangeRole = async (targetUserId: string, newRole: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchUsers();
      } else {
        setActionError(data.error?.message || 'Failed to update role.');
      }
    } catch {
      setActionError('Network error while updating role.');
    }
  };

  return (
    <AppLayout
      title="Administrative Security Console"
      description="System-wide organizational governance, account lifecycle, and tamper-evident audit verification"
      requireAdmin
    >
      {/* Notice Banner: No Admin Bypass */}
      <div className="mb-6 p-4 rounded-2xl bg-vault-850/80 border border-vault-accent/30 flex items-start gap-3">
        <Lock className="h-5 w-5 text-vault-accent shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-bold text-white block mb-0.5">
            Strict Separation of Duty & No Administrative Content Bypass
          </span>
          <span className="text-slate-300 leading-relaxed">
            As an Administrator, you can manage accounts, review security telemetry, and verify the cryptographic audit chain. In accordance with zero-trust principles, administrators cannot read or download confidential documents without explicit, audited permission grants from the document owner.
          </span>
        </div>
      </div>

      {actionError && (
        <div className="mb-6 p-3 rounded-xl bg-vault-danger/10 border border-vault-danger/30 text-xs text-vault-danger flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-vault-900 border border-vault-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-slate-400">Total Accounts</span>
            <Users className="h-4 w-4 text-vault-accent" />
          </div>
          <div className="text-2xl font-bold text-white mb-0.5">{overview?.metrics?.totalUsers ?? '-'}</div>
          <div className="text-[11px] text-vault-success font-mono">
            {overview?.metrics?.activeUsers ?? 0} active users
          </div>
        </div>

        <div className="bg-vault-900 border border-vault-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-slate-400">Total Documents</span>
            <Lock className="h-4 w-4 text-slate-300" />
          </div>
          <div className="text-2xl font-bold text-white mb-0.5">{overview?.metrics?.totalDocuments ?? '-'}</div>
          <div className="text-[11px] text-slate-400 font-mono">System-wide metadata tracked</div>
        </div>

        <div className="bg-vault-900 border border-vault-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-slate-400">Denied Attempts</span>
            <ShieldAlert className="h-4 w-4 text-vault-danger" />
          </div>
          <div className="text-2xl font-bold text-vault-danger mb-0.5">
            {overview?.metrics?.deniedEventsCount ?? '-'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">Blocked & audited intrusions</div>
        </div>

        <div className="bg-vault-900 border border-vault-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-slate-400">Audit Chain</span>
            <ShieldCheck className="h-4 w-4 text-vault-success" />
          </div>
          <div className="text-2xl font-bold text-vault-success mb-0.5">
            {verificationResult?.isValid ? '100% VALID' : 'CHECKING'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono truncate">
            Seq #{verificationResult?.lastSequence ?? 0} • {truncateHash(verificationResult?.chainHeadHash, 10)}
          </div>
        </div>
      </div>

      {/* Cryptographic Chain Verification Section */}
      <div className="bg-vault-900 border border-vault-border rounded-2xl p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-vault-accent" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Cryptographic Audit Chain Verification
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Recalculates SHA-256 hashes sequentially across all audit blocks to detect any payload tampering, sequence gaps, or broken block links.
            </p>
          </div>

          <button
            onClick={handleVerifyChain}
            disabled={verifying}
            className="px-4 py-2 rounded-xl bg-vault-850 hover:bg-vault-800 border border-vault-border text-xs font-semibold text-vault-accent flex items-center gap-2 transition disabled:opacity-50"
          >
            <RotateCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Recomputing Hashes...' : 'Verify Cryptographic Chain'}</span>
          </button>
        </div>

        {verificationResult && (
          <div
            className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs ${
              verificationResult.isValid
                ? 'bg-vault-success/10 border-vault-success/30 text-vault-success'
                : 'bg-vault-danger/10 border-vault-danger/30 text-vault-danger'
            }`}
          >
            <div className="flex items-center gap-3">
              {verificationResult.isValid ? (
                <CheckCircle2 className="h-5 w-5 text-vault-success shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-vault-danger shrink-0" />
              )}
              <div>
                <span className="font-bold block">
                  {verificationResult.isValid
                    ? 'CHAIN INTEGRITY VERIFIED: All blocks cryptographic hashes match canonical payloads'
                    : 'INTEGRITY ALERT: Inconsistent or corrupted blocks detected in database audit trail'}
                </span>
                <span className="text-[11px] opacity-80 block mt-0.5">
                  Verified {verificationResult.totalEvents} blocks • Chain Head: {verificationResult.chainHeadHash}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push('/audit')}
              className="text-[11px] underline opacity-90 hover:opacity-100 flex items-center gap-1 shrink-0"
            >
              <span>Examine Audit Records</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* User Governance & Account Lifecycle Table */}
      <div className="bg-vault-900 border border-vault-border rounded-2xl overflow-hidden shadow-xl mb-8">
        <div className="p-5 border-b border-vault-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">User Account Governance</h3>
            <p className="text-xs text-slate-400">Manage organizational roles, status, and account deactivation</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter users by name or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-vault-950 border border-vault-border text-xs text-white placeholder-slate-500 outline-none focus:border-vault-accent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-vault-border bg-vault-950/40 text-slate-400 font-mono uppercase text-[10px]">
                <th className="py-3.5 px-6 font-semibold">User Identity</th>
                <th className="py-3.5 px-4 font-semibold">Organizational Role</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Documents Owned</th>
                <th className="py-3.5 px-4 font-semibold">Created</th>
                <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-border/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-mono">
                    Loading users...
                  </td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No users found matching search.
                  </td>
                </tr>
              ) : (
                usersList.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id} className="hover:bg-vault-850/30 transition">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {isSelf && (
                            <span className="text-[10px] font-mono text-vault-accent bg-vault-accent/10 px-1.5 py-0.2 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {isSelf ? (
                          <span className="px-2 py-0.5 rounded bg-vault-800 border border-vault-border text-vault-accent font-semibold text-[10px]">
                            {u.role}
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => handleChangeRole(u.id, e.target.value)}
                            className="px-2 py-1 rounded bg-vault-950 border border-vault-border text-slate-200 text-xs font-mono outline-none focus:border-vault-accent cursor-pointer"
                          >
                            <option value={ROLES.ADMINISTRATOR}>ADMINISTRATOR</option>
                            <option value={ROLES.DOCUMENT_OWNER}>DOCUMENT_OWNER</option>
                            <option value={ROLES.VIEWER}>VIEWER</option>
                          </select>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            u.isActive
                              ? 'bg-vault-success/10 text-vault-success border border-vault-success/30'
                              : 'bg-vault-danger/10 text-vault-danger border border-vault-danger/30'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.isActive ? 'bg-vault-success' : 'bg-vault-danger'
                            }`}
                          />
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {u.documentCount} documents
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {formatDate(u.createdAt)}
                      </td>

                      <td className="py-3.5 px-6 text-right">
                        {!isSelf && (
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                              u.isActive
                                ? 'bg-vault-danger/10 hover:bg-vault-danger/20 border border-vault-danger/30 text-vault-danger'
                                : 'bg-vault-success/10 hover:bg-vault-success/20 border border-vault-success/30 text-vault-success'
                            }`}
                          >
                            {u.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
