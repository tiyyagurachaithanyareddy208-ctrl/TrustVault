'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  XCircle,
  X,
  RotateCw,
  Lock,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/components/auth-context';
import { formatDate, truncateHash } from '@/lib/utils';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES } from '@/lib/constants';

export default function AuditTrailPage() {
  const { user } = useAuth();

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Filters
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');

  // Selected event modal
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  // Chain verification status
  const [verification, setVerification] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  const fetchAuditEvents = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(actorFilter ? { actor: actorFilter } : {}),
        ...(actionFilter ? { action: actionFilter } : {}),
        ...(outcomeFilter ? { outcome: outcomeFilter } : {}),
      });

      // Administrators access the full system audit endpoint
      const endpoint = user?.role === 'ADMINISTRATOR' ? '/api/admin/audit' : '/api/admin/audit';
      const res = await fetch(`${endpoint}?${query.toString()}`);

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setEvents(data.data.items);
          setTotal(data.data.pagination.total);
        }
      }
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, actorFilter, actionFilter, outcomeFilter, user]);

  const fetchVerificationStatus = useCallback(async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/admin/audit/verify');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setVerification(data.data.verification);
        }
      }
    } catch (err) {
      console.error('Failed to verify audit chain:', err);
    } finally {
      setVerifying(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditEvents();
    if (user?.role === 'ADMINISTRATOR') {
      fetchVerificationStatus();
    }
  }, [fetchAuditEvents, fetchVerificationStatus, user]);

  return (
    <AppLayout
      title="Verifiable Cryptographic Audit Trail"
      description="Immutable SHA-256 hash-chained log of all authentication, authorization, and document operations"
    >
      {/* Verification Banner */}
      {verification && (
        <div
          className={`p-4 rounded-2xl border mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs ${
            verification.isValid
              ? 'bg-vault-success/10 border-vault-success/30 text-vault-success'
              : 'bg-vault-danger/10 border-vault-danger/30 text-vault-danger'
          }`}
        >
          <div className="flex items-center gap-3">
            {verification.isValid ? (
              <ShieldCheck className="h-6 w-6 text-vault-success shrink-0" />
            ) : (
              <ShieldAlert className="h-6 w-6 text-vault-danger shrink-0" />
            )}
            <div>
              <span className="font-bold text-sm block">
                {verification.isValid ? 'TAMPER-EVIDENT AUDIT CHAIN VERIFIED' : 'CHAIN COMPROMISE DETECTED'}
              </span>
              <span className="text-[11px] opacity-80 block mt-0.5">
                Head Block #{verification.lastSequence} • Hash: {verification.chainHeadHash}
              </span>
            </div>
          </div>

          <button
            onClick={fetchVerificationStatus}
            disabled={verifying}
            className="px-3.5 py-1.5 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 transition"
          >
            <RotateCw className={`h-3 w-3 ${verifying ? 'animate-spin' : ''}`} />
            <span>Re-verify Chain</span>
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by actor email or ID..."
            value={actorFilter}
            onChange={(e) => {
              setActorFilter(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-vault-900 border border-vault-border text-xs text-white placeholder-slate-500 outline-none focus:border-vault-accent"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-xl bg-vault-900 border border-vault-border text-xs text-slate-200 outline-none focus:border-vault-accent cursor-pointer"
        >
          <option value="">All Actions</option>
          {Object.values(AUDIT_ACTIONS).map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>

        <select
          value={outcomeFilter}
          onChange={(e) => {
            setOutcomeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-xl bg-vault-900 border border-vault-border text-xs text-slate-200 outline-none focus:border-vault-accent cursor-pointer"
        >
          <option value="">All Outcomes</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="DENIED">DENIED</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-vault-900 border border-vault-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-vault-border bg-vault-950/40 text-slate-400 uppercase text-[10px]">
                <th className="py-3.5 px-4 font-semibold">Seq</th>
                <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                <th className="py-3.5 px-4 font-semibold">Actor</th>
                <th className="py-3.5 px-4 font-semibold">Action</th>
                <th className="py-3.5 px-4 font-semibold">Target</th>
                <th className="py-3.5 px-4 font-semibold">Outcome</th>
                <th className="py-3.5 px-4 font-semibold">Current Hash</th>
                <th className="py-3.5 px-6 font-semibold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-border/50 text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500 font-mono">
                    <div className="h-6 w-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Querying cryptographic audit chain...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-sans">
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-vault-850/40 transition">
                    <td className="py-3 px-4 font-bold text-vault-accent">#{ev.sequence}</td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{formatDate(ev.timestamp)}</td>
                    <td className="py-3 px-4 text-slate-300 truncate max-w-[140px]">
                      {ev.actorEmail || 'Anonymous'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white truncate max-w-[180px]">
                      {ev.action}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-vault-800 border border-vault-border">
                        {ev.targetType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ev.outcome === 'SUCCESS'
                            ? 'bg-vault-success/10 text-vault-success border border-vault-success/30'
                            : 'bg-vault-danger/10 text-vault-danger border border-vault-danger/30'
                        }`}
                      >
                        {ev.outcome}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">
                      {truncateHash(ev.currentHash, 12)}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        onClick={() => setSelectedEvent(ev)}
                        title="Inspect Block Details"
                        className="p-1.5 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-slate-300 hover:text-white transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {total > limit && (
          <div className="p-4 border-t border-vault-border flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} audit records
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-slate-300 disabled:opacity-30 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono text-slate-300 px-2">Page {page}</span>
              <button
                disabled={page * limit >= total}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-slate-300 disabled:opacity-30 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Block Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-vault-900 border border-vault-border rounded-2xl w-full max-w-xl p-6 shadow-2xl relative font-mono text-xs">
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-5 w-5 text-vault-accent" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Audit Block #{selectedEvent.sequence} Inspection
              </h3>
            </div>

            <div className="space-y-3 mt-4 text-slate-300">
              <div className="grid grid-cols-2 gap-2 p-3 bg-vault-950 rounded-xl border border-vault-border">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Action</span>
                  <span className="font-bold text-white">{selectedEvent.action}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Outcome</span>
                  <span
                    className={selectedEvent.outcome === 'SUCCESS' ? 'text-vault-success' : 'text-vault-danger'}
                  >
                    {selectedEvent.outcome}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Actor</span>
                  <span className="text-white truncate block">{selectedEvent.actorEmail || 'System / Unauthenticated'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Correlation ID</span>
                  <span className="text-slate-400 truncate block">{selectedEvent.correlationId}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase mb-1">Previous Block Hash (Link)</span>
                <div className="p-2.5 bg-vault-950 rounded-lg border border-vault-border text-[11px] break-all select-all text-slate-400">
                  {selectedEvent.prevHash}
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase mb-1">Current Block Hash</span>
                <div className="p-2.5 bg-vault-950 rounded-lg border border-vault-border text-[11px] break-all select-all text-vault-accent font-bold">
                  {selectedEvent.currentHash}
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase mb-1">Sanitized Metadata</span>
                <pre className="p-3 bg-vault-950 rounded-lg border border-vault-border text-[11px] overflow-x-auto text-slate-300 max-h-48">
                  {JSON.stringify(selectedEvent.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-vault-border flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 rounded-xl bg-vault-850 hover:bg-vault-800 text-slate-300 text-xs font-semibold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
