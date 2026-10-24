'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  FileText,
  Download,
  Share2,
  Trash2,
  Edit3,
  Clock,
  ShieldCheck,
  UserCheck,
  Lock,
  Layers,
  Copy,
  Check,
  AlertTriangle,
  ArrowLeft,
  X,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/components/auth-context';
import { formatBytes, formatDate, truncateHash } from '@/lib/utils';
import { DOCUMENT_CATEGORIES } from '@/lib/constants';

function DocumentDetailsContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const { user } = useAuth();

  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'shares' | 'audit'>('overview');
  const [copiedHash, setCopiedHash] = useState(false);

  // Sharing states
  const [permissions, setPermissions] = useState<any[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<'READ' | 'EDIT'>('READ');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Edit metadata modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Audit timeline
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Auto-open shares tab if URL has ?tab=shares
  useEffect(() => {
    if (searchParams?.get('tab') === 'shares') {
      setActiveTab('shares');
    }
  }, [searchParams]);

  const fetchDocument = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (res.status === 404 || res.status === 403) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setDocument(data.data);
        setEditTitle(data.data.title);
        setEditDescription(data.data.description || '');
        setEditCategory(data.data.category);
        if (data.data.isOwner) {
          setPermissions(data.data.permissions || []);
        }
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}/audit`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAuditEvents(data.data.auditEvents);
        }
      }
    } catch (err) {
      console.error('Failed to load audit events:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchDocument();
    }
  }, [id, fetchDocument]);

  useEffect(() => {
    if (activeTab === 'audit' && document?.isOwner) {
      fetchAudit();
    }
  }, [activeTab, document, fetchAudit]);

  const handleCopyHash = () => {
    if (document?.sha256Hash) {
      navigator.clipboard.writeText(document.sha256Hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareError(null);
    setShareLoading(true);

    try {
      const res = await fetch(`/api/documents/${id}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          granteeEmail: shareEmail,
          permission: sharePermission,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShareEmail('');
        fetchDocument();
      } else {
        setShareError(data.error?.message || 'Failed to grant permission.');
      }
    } catch {
      setShareError('Network error while creating grant.');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokePermission = async (permissionId: string) => {
    try {
      const res = await fetch(`/api/documents/${id}/permissions/${permissionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPermissions((prev) => prev.filter((p) => p.id !== permissionId));
      }
    } catch (err) {
      console.error('Failed to revoke permission:', err);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          category: editCategory,
        }),
      });

      if (res.ok) {
        setShowEditModal(false);
        fetchDocument();
      }
    } catch (err) {
      console.error('Failed to update metadata:', err);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/documents');
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Loading Document...">
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 font-mono text-xs">
          <div className="h-8 w-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mb-4" />
          <span>Validating authorization and loading document...</span>
        </div>
      </AppLayout>
    );
  }

  if (notFound) {
    return (
      <AppLayout title="Access Denied / Not Found">
        <div className="max-w-lg mx-auto py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-vault-danger/10 border border-vault-danger/30 flex items-center justify-center text-vault-danger mx-auto mb-4">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Document Inaccessible</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            The requested document either does not exist or your credentials lack server-side authorization. Knowing a document ID or URL does not grant access.
          </p>
          <button
            onClick={() => router.push('/documents')}
            className="px-4 py-2 rounded-xl bg-vault-850 hover:bg-vault-800 border border-vault-border text-xs text-slate-300 font-medium transition"
          >
            Return to Authorized Library
          </button>
        </div>
      </AppLayout>
    );
  }

  const canEdit = document?.isOwner || document?.effectivePermission === 'EDIT';
  const canDownload = document?.effectivePermission !== 'ADMIN_METADATA_ONLY';

  return (
    <AppLayout
      title={document.title}
      description={`${document.originalFilename} • ${formatBytes(document.fileSize)} • Owned by ${document.isOwner ? 'You' : document.owner.name}`}
    >
      {/* Top Breadcrumb & Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <button
          onClick={() => router.push('/documents')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition font-mono"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Library</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          {canDownload && (
            <a
              href={`/api/documents/${document.id}/download`}
              className="px-4 py-2 rounded-xl bg-vault-accent text-vault-950 font-bold text-xs flex items-center gap-1.5 hover:brightness-110 active:brightness-95 transition shadow-[0_0_15px_rgba(0,229,255,0.2)]"
            >
              <Download className="h-4 w-4" />
              <span>Download File</span>
            </a>
          )}

          {canEdit && (
            <button
              onClick={() => setShowEditModal(true)}
              className="px-3.5 py-2 rounded-xl bg-vault-850 hover:bg-vault-800 border border-vault-border text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Metadata</span>
            </button>
          )}

          {document.isOwner && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3.5 py-2 rounded-xl bg-vault-danger/10 hover:bg-vault-danger/20 border border-vault-danger/30 text-vault-danger text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-vault-border mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-4 text-xs font-semibold tracking-wide border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-vault-accent text-vault-accent'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Document Overview
        </button>

        {document.isOwner && (
          <button
            onClick={() => setActiveTab('shares')}
            className={`pb-3 px-4 text-xs font-semibold tracking-wide border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'shares'
                ? 'border-vault-accent text-vault-accent'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>Sharing Grants</span>
            <span className="px-1.5 py-0.2 rounded-full bg-vault-800 text-[10px] font-mono text-vault-accent">
              {permissions.length}
            </span>
          </button>
        )}

        {document.isOwner && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-4 text-xs font-semibold tracking-wide border-b-2 transition ${
              activeTab === 'audit'
                ? 'border-vault-accent text-vault-accent'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Cryptographic Audit Trail
          </button>
        )}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Description Card */}
            <div className="bg-vault-900 border border-vault-border rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white tracking-tight mb-2">Description & Notes</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {document.description || 'No description provided.'}
              </p>
            </div>

            {/* Cryptographic Content Verification Card */}
            <div className="bg-vault-900 border border-vault-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-vault-success" />
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Cryptographic Content Integrity (SHA-256)
                  </h3>
                </div>
                <button
                  onClick={handleCopyHash}
                  className="flex items-center gap-1 text-[11px] font-mono text-vault-accent hover:underline"
                >
                  {copiedHash ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy Hash
                    </>
                  )}
                </button>
              </div>
              <div className="p-3 rounded-xl bg-vault-950 border border-vault-border font-mono text-xs text-slate-300 break-all select-all">
                {document.sha256Hash}
              </div>
              <div className="mt-2 text-[10px] text-slate-500 font-mono">
                Computed over raw file bytes at upload time. Used to detect silent payload corruption or unauthorized modification.
              </div>
            </div>
          </div>

          {/* Metadata Sidebar (1 Column) */}
          <div className="space-y-6">
            <div className="bg-vault-900 border border-vault-border rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight border-b border-vault-border pb-3">
                Security Metadata
              </h3>

              <div className="text-xs space-y-3 font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Effective Permission</span>
                  <span className="text-vault-accent font-bold text-sm mt-0.5 inline-block">
                    {document.effectivePermission}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Classification</span>
                  <span className="px-2 py-0.5 rounded bg-vault-800 border border-vault-border text-white text-[11px] mt-1 inline-block">
                    {document.category}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Original Filename</span>
                  <span className="text-slate-200 mt-0.5 block truncate">{document.originalFilename}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">MIME Type</span>
                  <span className="text-slate-200 mt-0.5 block">{document.mimeType}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Payload Size</span>
                  <span className="text-slate-200 mt-0.5 block">{formatBytes(document.fileSize)}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Document Owner</span>
                  <span className="text-slate-200 mt-0.5 block">
                    {document.owner.name} ({document.owner.email})
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Uploaded At</span>
                  <span className="text-slate-200 mt-0.5 block">{formatDate(document.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Sharing Grants (Document Owner Only) */}
      {activeTab === 'shares' && document.isOwner && (
        <div className="space-y-6">
          {/* Grant New Permission Form */}
          <div className="bg-vault-900 border border-vault-border rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white tracking-tight mb-1">Grant Access to Named User</h3>
            <p className="text-xs text-slate-400 mb-4">
              Access is validated against active directory status and enforced immediately on the server.
            </p>

            {shareError && (
              <div className="mb-4 p-3 rounded-xl bg-vault-danger/10 border border-vault-danger/30 text-xs text-vault-danger flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{shareError}</span>
              </div>
            )}

            <form onSubmit={handleGrantPermission} className="flex flex-col md:flex-row items-end gap-3">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">User Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. viewer-b@example.test"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-vault-950 border border-vault-border focus:border-vault-accent text-xs text-white placeholder-slate-500 outline-none transition"
                />
              </div>

              <div className="w-full md:w-48">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Permission Level</label>
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value as 'READ' | 'EDIT')}
                  className="w-full px-3.5 py-2 rounded-xl bg-vault-950 border border-vault-border focus:border-vault-accent text-xs text-white outline-none cursor-pointer"
                >
                  <option value="READ">READ (View & Download)</option>
                  <option value="EDIT">EDIT (Read + Update Metadata)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={shareLoading || !shareEmail}
                className="px-4 py-2 rounded-xl bg-vault-accent text-vault-950 font-bold text-xs hover:brightness-110 active:brightness-95 transition disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Grant Access</span>
              </button>
            </form>
          </div>

          {/* Current Grants Table */}
          <div className="bg-vault-900 border border-vault-border rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-vault-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight">Active Named Grants</h3>
              <span className="text-xs text-slate-400 font-mono">{permissions.length} active grants</span>
            </div>

            {permissions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No external users currently have access to this document.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-vault-border bg-vault-950/40 text-slate-400 font-mono uppercase text-[10px]">
                    <th className="py-3 px-6 font-semibold">User</th>
                    <th className="py-3 px-4 font-semibold">Permission Level</th>
                    <th className="py-3 px-4 font-semibold">Granted Date</th>
                    <th className="py-3 px-6 font-semibold text-right">Revoke Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-vault-border/50">
                  {permissions.map((grant) => (
                    <tr key={grant.id} className="hover:bg-vault-850/30 transition">
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-white">{grant.grantee.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{grant.grantee.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            grant.permission === 'EDIT'
                              ? 'bg-vault-warning/10 border border-vault-warning/30 text-vault-warning'
                              : 'bg-vault-accent/10 border border-vault-accent/30 text-vault-accent'
                          }`}
                        >
                          {grant.permission}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {formatDate(grant.createdAt)}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={() => handleRevokePermission(grant.id)}
                          className="px-2.5 py-1 rounded-lg bg-vault-danger/10 hover:bg-vault-danger/20 border border-vault-danger/30 text-vault-danger font-medium text-xs transition"
                        >
                          Revoke Access
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Cryptographic Audit Trail (Document Owner Only) */}
      {activeTab === 'audit' && document.isOwner && (
        <div className="bg-vault-900 border border-vault-border rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-vault-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Verifiable Audit Timeline</h3>
              <p className="text-xs text-slate-400">Cryptographically chained events for this document</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-vault-success">
              <ShieldCheck className="h-4 w-4" />
              <span>Chained & Immutable</span>
            </div>
          </div>

          {auditLoading ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs">
              Loading cryptographic audit events...
            </div>
          ) : auditEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-mono">
              No audit events recorded for this document yet.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-vault-border bg-vault-950/40 text-slate-400 uppercase text-[10px]">
                  <th className="py-3 px-4 font-semibold">Seq</th>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Actor</th>
                  <th className="py-3 px-4 font-semibold">Outcome</th>
                  <th className="py-3 px-6 font-semibold">Block Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vault-border/50">
                {auditEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-vault-850/30 transition text-[11px]">
                    <td className="py-3 px-4 font-bold text-vault-accent">#{ev.sequence}</td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{formatDate(ev.timestamp)}</td>
                    <td className="py-3 px-4 text-white font-semibold">{ev.action}</td>
                    <td className="py-3 px-4 text-slate-300">{ev.actorEmail || 'System'}</td>
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
                    <td className="py-3 px-6 text-slate-400 font-mono text-[10px]">
                      {truncateHash(ev.currentHash, 14)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Edit Metadata Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-vault-900 border border-vault-border rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-base font-bold text-white mb-4">Edit Document Metadata</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-vault-950 border border-vault-border text-xs text-white outline-none focus:border-vault-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-vault-950 border border-vault-border text-xs text-white outline-none cursor-pointer"
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-vault-950 border border-vault-border text-xs text-white outline-none focus:border-vault-accent resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-vault-border">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-vault-850 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-1.5 rounded-xl bg-vault-accent text-vault-950 font-bold text-xs"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-vault-900 border border-vault-border rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="h-10 w-10 rounded-xl bg-vault-danger/10 border border-vault-danger/30 flex items-center justify-center text-vault-danger mb-3">
              <Trash2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Delete Document?</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              This action permanently purges the file from private storage and deletes metadata. An immutable audit record will be preserved.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-3.5 py-2 rounded-xl bg-vault-850 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDeleteSubmit}
                className="px-4 py-2 rounded-xl bg-vault-danger text-white font-bold text-xs hover:brightness-110 transition"
              >
                {deleteLoading ? 'Purging...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function DocumentDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-vault-950 flex items-center justify-center text-slate-500 font-mono text-xs">
          Loading Document Details...
        </div>
      }
    >
      <DocumentDetailsContent />
    </Suspense>
  );
}
