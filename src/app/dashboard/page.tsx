'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Share2,
  Lock,
  Download,
  Clock,
  ShieldCheck,
  ArrowUpRight,
  Plus,
  Eye,
  Layers,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/components/auth-context';
import { formatBytes, formatDate, truncateHash } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [stats, setStats] = useState({
    accessibleTotal: 0,
    ownedTotal: 0,
    sharedTotal: 0,
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, number>>({});
  const [auditStatus, setAuditStatus] = useState<any>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const docRes = await fetch('/api/documents?limit=100');
        if (docRes.ok) {
          const docData = await docRes.json();
          if (docData.success) {
            const docs = docData.data.items;
            setDocuments(docs);

            const owned = docs.filter((d: any) => d.isOwner).length;
            const shared = docs.filter((d: any) => !d.isOwner).length;

            setStats({
              accessibleTotal: docs.length,
              ownedTotal: owned,
              sharedTotal: shared,
            });

            const catMap: Record<string, number> = {};
            for (const d of docs) {
              catMap[d.category] = (catMap[d.category] || 0) + 1;
            }
            setCategoryBreakdown(catMap);
          }
        }

        // Fetch health status
        const healthRes = await fetch('/api/health');
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setAuditStatus(healthData);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  return (
    <AppLayout
      title="Security Operations Dashboard"
      description="Real-time authorized document inventory and zero-trust telemetry"
    >
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-vault-900 border border-vault-border rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-400">Total Authorized</span>
            <div className="h-8 w-8 rounded-lg bg-vault-800 border border-vault-border flex items-center justify-center text-vault-accent">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {loading ? '-' : stats.accessibleTotal}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">Server-authorized discoverable docs</div>
        </div>

        <div className="bg-vault-900 border border-vault-border rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-400">Owned Documents</span>
            <div className="h-8 w-8 rounded-lg bg-vault-800 border border-vault-border flex items-center justify-center text-vault-success">
              <Lock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {loading ? '-' : stats.ownedTotal}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">Full control & grant management</div>
        </div>

        <div className="bg-vault-900 border border-vault-border rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-400">Explicitly Shared</span>
            <div className="h-8 w-8 rounded-lg bg-vault-800 border border-vault-border flex items-center justify-center text-vault-accent">
              <Share2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {loading ? '-' : stats.sharedTotal}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">Granted READ or EDIT access</div>
        </div>

        <div className="bg-vault-900 border border-vault-border rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-400">Audit Verification</span>
            <div className="h-8 w-8 rounded-lg bg-vault-800 border border-vault-border flex items-center justify-center text-vault-success">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-vault-success mb-1">
            {auditStatus?.services?.auditChain === 'up' ? 'VERIFIED' : 'ACTIVE'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">SHA-256 Hash Chained</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Documents Table (2 Columns) */}
        <div className="lg:col-span-2 bg-vault-900 border border-vault-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Recent Authorized Documents</h2>
              <p className="text-xs text-slate-400">Documents discoverable under your credentials</p>
            </div>
            <div className="flex items-center gap-2">
              {user?.role !== 'VIEWER' && (
                <button
                  onClick={() => router.push('/documents?action=upload')}
                  className="px-3 py-1.5 rounded-lg bg-vault-accent text-vault-950 font-semibold text-xs flex items-center gap-1.5 hover:brightness-110 transition shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Upload
                </button>
              )}
              <button
                onClick={() => router.push('/documents')}
                className="px-3 py-1.5 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-slate-300 font-medium text-xs flex items-center gap-1 transition"
              >
                <span>View All</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center text-slate-500 font-mono text-xs">
              Loading authorized documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <div className="text-sm font-medium">No accessible documents found</div>
              <p className="text-xs text-slate-500 mt-1">
                You do not currently own or hold grants for any documents.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-vault-border text-slate-400 font-mono uppercase text-[10px]">
                    <th className="pb-3 font-semibold">Document Title</th>
                    <th className="pb-3 font-semibold">Category</th>
                    <th className="pb-3 font-semibold">Owner</th>
                    <th className="pb-3 font-semibold">Permission</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-vault-border/50">
                  {documents.slice(0, 6).map((doc) => (
                    <tr key={doc.id} className="hover:bg-vault-850/40 transition">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-white truncate max-w-[220px]">
                          {doc.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[220px]">
                          {doc.originalFilename} • {formatBytes(doc.fileSize)}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="px-2 py-0.5 rounded bg-vault-800 border border-vault-border text-slate-300 font-mono text-[10px]">
                          {doc.category}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-mono text-slate-400 truncate max-w-[120px]">
                        {doc.isOwner ? (
                          <span className="text-vault-success font-medium">You</span>
                        ) : (
                          doc.owner.name
                        )}
                      </td>
                      <td className="py-3 pr-3 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            doc.effectivePermission === 'OWNER'
                              ? 'bg-vault-success/10 border border-vault-success/30 text-vault-success'
                              : doc.effectivePermission === 'EDIT'
                              ? 'bg-vault-warning/10 border border-vault-warning/30 text-vault-warning'
                              : 'bg-vault-accent/10 border border-vault-accent/30 text-vault-accent'
                          }`}
                        >
                          {doc.effectivePermission}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => router.push(`/documents/${doc.id}`)}
                            title="View Details"
                            className="p-1.5 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-slate-300 hover:text-white transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {doc.effectivePermission !== 'ADMIN_METADATA_ONLY' && (
                            <a
                              href={`/api/documents/${doc.id}/download`}
                              title="Download File"
                              className="p-1.5 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-slate-300 hover:text-vault-accent transition"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar: Security Telemetry & Category Breakdown (1 Column) */}
        <div className="space-y-6">
          {/* Category Breakdown Card */}
          <div className="bg-vault-900 border border-vault-border rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white tracking-tight mb-1">Category Breakdown</h3>
            <p className="text-xs text-slate-400 mb-4">Distribution across authorized classifications</p>

            <div className="space-y-2.5">
              {Object.keys(categoryBreakdown).length === 0 ? (
                <div className="text-xs text-slate-500 font-mono py-2">No documents to categorize</div>
              ) : (
                Object.entries(categoryBreakdown).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-300">{cat}</span>
                    <span className="px-2 py-0.5 rounded-full bg-vault-800 border border-vault-border text-vault-accent font-mono text-[11px] font-bold">
                      {count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cryptographic Assurance Card */}
          <div className="bg-vault-900 border border-vault-border rounded-2xl p-6 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-vault-accent" />
              <h3 className="text-sm font-bold text-white tracking-tight">Zero-Trust Guarantees</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Every sensitive operation is cryptographically audited and validated deny-by-default on the server.
            </p>
            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-vault-accent" />
                <span>Strict IDOR Defense (Uniform 404)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-vault-accent" />
                <span>Magic-byte MIME verification</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-vault-accent" />
                <span>Immediate permission revocation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-vault-accent" />
                <span>No admin confidentiality bypass</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
