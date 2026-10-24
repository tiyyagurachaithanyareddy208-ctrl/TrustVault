'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Download,
  Eye,
  Share2,
  Trash2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/components/auth-context';
import { formatBytes, formatDate } from '@/lib/utils';
import { DOCUMENT_CATEGORIES } from '@/lib/constants';

function DocumentLibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory, setUploadCategory] = useState('GENERAL');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Auto-open upload if url query contains ?action=upload
  useEffect(() => {
    if (searchParams?.get('action') === 'upload') {
      setShowUploadModal(true);
    }
  }, [searchParams]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort: sortBy,
        order: sortOrder,
        ...(search ? { search } : {}),
        ...(category ? { category } : {}),
      });

      const res = await fetch(`/api/documents?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDocuments(data.data.items);
          setTotal(data.data.pagination.total);
        }
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, category, sortBy, sortOrder]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);
    setUploadLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle || uploadFile.name);
      formData.append('description', uploadDescription);
      formData.append('category', uploadCategory);

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUploadSuccess('Document successfully uploaded and cryptographically indexed.');
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadTitle('');
          setUploadDescription('');
          setUploadSuccess(null);
          fetchDocuments();
        }, 1200);
      } else {
        setUploadError(data.error?.message || 'Upload failed.');
      }
    } catch {
      setUploadError('Network error during file upload.');
    } finally {
      setUploadLoading(false);
    }
  };

  const getDocIcon = (mime: string) => {
    if (mime.includes('pdf')) return <FileText className="h-5 w-5 text-vault-accent" />;
    if (mime.includes('spreadsheet') || mime.includes('excel'))
      return <FileSpreadsheet className="h-5 w-5 text-vault-success" />;
    if (mime.includes('image')) return <ImageIcon className="h-5 w-5 text-purple-400" />;
    return <FileCode className="h-5 w-5 text-vault-warning" />;
  };

  return (
    <AppLayout
      title="Secure Document Library"
      description="Authorized confidential document repository with granular access control"
    >
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, filename, or description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-vault-900 border border-vault-border focus:border-vault-accent focus:ring-1 focus:ring-vault-accent text-xs text-white placeholder-slate-500 outline-none transition"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="px-3.5 py-2 rounded-xl bg-vault-900 border border-vault-border text-xs text-slate-200 outline-none focus:border-vault-accent cursor-pointer"
            >
              <option value="">All Categories</option>
              {DOCUMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Filter */}
          <div className="relative">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb);
                setSortOrder(so as 'asc' | 'desc');
              }}
              className="px-3.5 py-2 rounded-xl bg-vault-900 border border-vault-border text-xs text-slate-200 outline-none focus:border-vault-accent cursor-pointer"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="title-asc">Title (A-Z)</option>
              <option value="fileSize-desc">File Size</option>
            </select>
          </div>
        </div>

        {/* Upload Action */}
        {user?.role !== 'VIEWER' && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2.5 rounded-xl bg-vault-accent text-vault-950 font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:brightness-95 transition shadow-[0_0_15px_rgba(0,229,255,0.2)]"
          >
            <Plus className="h-4 w-4" />
            <span>Upload Document</span>
          </button>
        )}
      </div>

      {/* Documents Table */}
      <div className="bg-vault-900 border border-vault-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-vault-border bg-vault-950/40 text-slate-400 font-mono uppercase text-[10px]">
                <th className="py-3.5 px-6 font-semibold">Document</th>
                <th className="py-3.5 px-4 font-semibold">Category</th>
                <th className="py-3.5 px-4 font-semibold">Owner</th>
                <th className="py-3.5 px-4 font-semibold">Access Grant</th>
                <th className="py-3.5 px-4 font-semibold">Created</th>
                <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-border/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500 font-mono">
                    <div className="h-6 w-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Querying authorized document index...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-30 text-slate-500" />
                    <div className="text-sm font-semibold text-white">No discoverable documents</div>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {search || category
                        ? 'No documents matched your search criteria.'
                        : 'You do not currently own or hold grants for any documents.'}
                    </p>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-vault-850/40 transition group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-vault-800 border border-vault-border flex items-center justify-center shrink-0">
                          {getDocIcon(doc.mimeType)}
                        </div>
                        <div className="min-w-0">
                          <button
                            onClick={() => router.push(`/documents/${doc.id}`)}
                            className="font-bold text-white hover:text-vault-accent transition truncate text-left block text-sm max-w-xs md:max-w-md"
                          >
                            {doc.title}
                          </button>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>{doc.originalFilename}</span>
                            <span>•</span>
                            <span>{formatBytes(doc.fileSize)}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-md bg-vault-800 border border-vault-border text-slate-300 font-mono text-[10px] font-medium">
                        {doc.category}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-mono text-slate-300">
                      {doc.isOwner ? (
                        <span className="inline-flex items-center gap-1.5 text-vault-success font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-vault-success" />
                          You
                        </span>
                      ) : (
                        <span>{doc.owner.name}</span>
                      )}
                    </td>

                    <td className="py-4 px-4 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                          doc.effectivePermission === 'OWNER'
                            ? 'bg-vault-success/10 border border-vault-success/30 text-vault-success'
                            : doc.effectivePermission === 'EDIT'
                            ? 'bg-vault-warning/10 border border-vault-warning/30 text-vault-warning'
                            : doc.effectivePermission === 'READ'
                            ? 'bg-vault-accent/10 border border-vault-accent/30 text-vault-accent'
                            : 'bg-vault-800 border border-vault-border text-slate-400'
                        }`}
                      >
                        {doc.effectivePermission}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {formatDate(doc.createdAt)}
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => router.push(`/documents/${doc.id}`)}
                          title="View Details"
                          className="p-2 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-slate-300 hover:text-white transition"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Download button - strictly rendered only if permitted */}
                        {doc.effectivePermission !== 'ADMIN_METADATA_ONLY' && (
                          <a
                            href={`/api/documents/${doc.id}/download`}
                            title="Download Verified File"
                            className="p-2 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-slate-300 hover:text-vault-accent transition"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}

                        {/* Share button - strictly for Document Owner */}
                        {doc.isOwner && (
                          <button
                            onClick={() => router.push(`/documents/${doc.id}?tab=shares`)}
                            title="Manage Named Grants"
                            className="p-2 rounded-lg bg-vault-850 hover:bg-vault-800 border border-vault-border text-slate-300 hover:text-vault-success transition"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
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
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} documents
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

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-vault-900 border border-vault-border rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-8 w-8 rounded-lg bg-vault-800 border border-vault-accent/30 flex items-center justify-center text-vault-accent">
                <Upload className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">Upload Confidential Document</h2>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Payload is validated by file signature (magic bytes) and saved to isolated private storage.
            </p>

            {uploadError && (
              <div className="mb-4 p-3 rounded-xl bg-vault-danger/10 border border-vault-danger/30 text-xs text-vault-danger flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-vault-success/10 border border-vault-success/30 text-xs text-vault-success flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select Document (PDF, DOCX, XLSX, PNG, JPEG &le; 25MB)
                </label>
                <div className="border-2 border-dashed border-vault-border hover:border-vault-accent rounded-xl p-6 text-center cursor-pointer transition bg-vault-950/40 relative">
                  <input
                    type="file"
                    required
                    accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setUploadFile(f);
                        if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^/.]+$/, ''));
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="h-8 w-8 text-vault-accent mx-auto mb-2 opacity-80" />
                  {uploadFile ? (
                    <div>
                      <div className="font-semibold text-white text-xs truncate max-w-xs mx-auto">
                        {uploadFile.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {formatBytes(uploadFile.size)} • Ready for upload
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs text-slate-300 font-medium">
                        Drag and drop file here, or click to browse
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        Magic-byte signatures verified on server
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Financial Statement"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-vault-950 border border-vault-border focus:border-vault-accent focus:ring-1 focus:ring-vault-accent text-xs text-white placeholder-slate-500 outline-none transition"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Classification Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-vault-950 border border-vault-border focus:border-vault-accent text-xs text-white outline-none cursor-pointer"
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Context, sensitivity notes, or summary..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-vault-950 border border-vault-border focus:border-vault-accent focus:ring-1 focus:ring-vault-accent text-xs text-white placeholder-slate-500 outline-none transition resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-vault-border">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl bg-vault-850 hover:bg-vault-800 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading || !uploadFile}
                  className="px-5 py-2 rounded-xl bg-vault-accent text-vault-950 font-bold text-xs hover:brightness-110 active:brightness-95 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {uploadLoading ? (
                    <>
                      <div className="h-3.5 w-3.5 border-2 border-vault-950 border-t-transparent rounded-full animate-spin" />
                      <span>Validating & Storing...</span>
                    </>
                  ) : (
                    <span>Store in Vault</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function DocumentLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-vault-950 flex items-center justify-center text-slate-500 font-mono text-xs">
          Loading Document Library...
        </div>
      }
    >
      <DocumentLibraryContent />
    </Suspense>
  );
}
