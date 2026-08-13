'use client';

import React, { useState } from 'react';
import { Note, AccessType, ShareType } from '@prisma/client';
import Link from 'next/link';
import {
  ExternalLink,
  Lock,
  Eye,
  Trash2,
  ShieldAlert,
  Clock,
  CheckCircle,
  Share2,
  Copy,
  Check,
  Ban,
  RotateCcw,
  KeyRound,
  RefreshCw,
  X,
} from 'lucide-react';
import { toggleRevokeNote, deleteNote, regeneratePassword } from '@/lib/actions/notes';

interface NotesTableProps {
  initialNotes: Note[];
}

export const NotesTable: React.FC<NotesTableProps> = ({ initialNotes }) => {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [shareModalNote, setShareModalNote] = useState<Note | null>(null);

  // Copy state for share modal
  const [linkCopied, setLinkCopied] = useState(false);
  const [passCopied, setPassCopied] = useState(false);
  const [activePassword, setActivePassword] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // Toggle Revoke / Unrevoke
  const handleToggleRevoke = async (note: Note) => {
    const res = await toggleRevokeNote(note.id);
    if (res.success) {
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? res.data : n)),
      );
      if (shareModalNote?.id === note.id) {
        setShareModalNote(res.data);
      }
    } else {
      alert(res.error);
    }
  };

  // Delete Note (Works for Revoked, Expired, or Active notes)
  const handleDeleteNote = async (id: string) => {
    const res = await deleteNote(id);
    if (res.success) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setConfirmDeleteId(null);
      if (shareModalNote?.id === id) {
        setShareModalNote(null);
      }
    } else {
      alert(res.error);
    }
  };

  // Open Share Popover
  const handleOpenShare = (note: Note) => {
    setShareModalNote(note);
    setActivePassword(null);
    setLinkCopied(false);
    setPassCopied(false);
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleCopyPassword = (pass: string) => {
    navigator.clipboard.writeText(pass);
    setPassCopied(true);
    setTimeout(() => setPassCopied(false), 2000);
  };

  const handleRegeneratePasswordModal = async (noteId: string) => {
    setRegenerating(true);
    const res = await regeneratePassword(noteId);
    setRegenerating(false);
    if (res.success) {
      setActivePassword(res.data.plaintext);
    } else {
      alert(res.error);
    }
  };

  if (notes.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">No notes created yet</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
          Create your first secure, shareable note with customizable expiration and password parameters.
        </p>
        <Link
          href="/notes/new"
          className="inline-flex items-center px-4 py-2 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          Create your first note
        </Link>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-3">Title</th>
              <th className="px-6 py-3">Share Type</th>
              <th className="px-6 py-3">Access Type</th>
              <th className="px-6 py-3">Expiry (IST)</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Total Views</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {notes.map((note) => {
              const isExpired = note.expiryDate && new Date(note.expiryDate) < new Date();
              const istExpiry = note.expiryDate
                ? new Date(new Date(note.expiryDate).getTime() + 330 * 60 * 1000).toLocaleString('en-IN')
                : 'Never';

              return (
                <tr
                  key={note.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                    <Link href={`/notes/${note.id}`} className="hover:underline flex items-center gap-2">
                      {note.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        note.shareType === ShareType.COLLABORATIVE
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {note.shareType === ShareType.COLLABORATIVE ? 'Collaborative' : 'Read-Only'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {note.accessType === AccessType.PASSWORD && <Lock className="w-3 h-3 text-amber-500" />}
                      {note.accessType === AccessType.ONE_TIME && <ShieldAlert className="w-3 h-3 text-red-500" />}
                      {note.accessType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{istExpiry}</td>
                  <td className="px-6 py-4">
                    {note.revoked ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded">
                        <Ban className="w-3 h-3" /> Revoked {note.consumedAt ? '(Consumed)' : ''}
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-slate-400" /> {note.viewCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-1.5">
                    {/* Share Window Trigger */}
                    <button
                      onClick={() => handleOpenShare(note)}
                      className="inline-flex items-center p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      title="Open Share Window"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    {/* Open link in new tab */}
                    <a
                      href={`/share/${note.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Open Share Link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    {/* Revoke / Unrevoke Toggle Button */}
                    <button
                      onClick={() => handleToggleRevoke(note)}
                      className={`inline-flex items-center p-1.5 rounded transition-colors ${
                        note.revoked
                          ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                          : 'text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                      }`}
                      title={note.revoked ? 'Unrevoke Note' : 'Revoke Note'}
                    >
                      {note.revoked ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    </button>

                    {/* Delete Note Button (Works for active and revoked notes) */}
                    <button
                      onClick={() => setConfirmDeleteId(note.id)}
                      className="inline-flex items-center p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/40"
                      title="Delete Note Permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Share Popover Window (Floating above) */}
      {shareModalNote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <button
              onClick={() => setShareModalNote(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Share Note</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{shareModalNote.title}</p>
            </div>

            {/* Status indicator inside share window */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
              <span className="font-semibold text-slate-500">Access:</span>
              <span className="font-bold flex items-center gap-1">
                {shareModalNote.revoked ? (
                  <span className="text-red-600 flex items-center gap-1">
                    <Ban className="w-3.5 h-3.5" /> Revoked
                  </span>
                ) : shareModalNote.accessType === AccessType.PASSWORD ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Password Protected
                  </span>
                ) : shareModalNote.accessType === AccessType.ONE_TIME ? (
                  <span className="text-red-500 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> One-Time View
                  </span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Public
                  </span>
                )}
              </span>
            </div>

            {/* Share Link Input with Copy Clipboard */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Share Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/share/${shareModalNote.token}`}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none select-all"
                />
                <button
                  onClick={() => handleCopyLink(shareModalNote.token)}
                  className="px-3 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity shrink-0"
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Password Section if password-protected */}
            {shareModalNote.accessType === AccessType.PASSWORD && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" /> Password
                  </span>
                  <button
                    onClick={() => handleRegeneratePasswordModal(shareModalNote.id)}
                    disabled={regenerating}
                    className="text-[11px] text-amber-700 dark:text-amber-400 underline hover:text-amber-900 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> {activePassword ? 'Regenerate' : 'Generate New Password'}
                  </button>
                </div>

                {activePassword ? (
                  <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-amber-200 dark:border-amber-800 font-mono text-sm font-bold">
                    <span>{activePassword}</span>
                    <button
                      onClick={() => handleCopyPassword(activePassword)}
                      className="px-2 py-1 bg-amber-600 text-white rounded text-xs flex items-center gap-1 hover:bg-amber-700"
                    >
                      {passCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Password is encrypted with bcrypt. Click &quot;Generate New Password&quot; above to issue a fresh password to share.
                  </p>
                )}
              </div>
            )}

            {/* Quick Action: Revoke/Unrevoke inside Share window */}
            <div className="pt-2 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => handleToggleRevoke(shareModalNote)}
                className={`text-xs font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg border ${
                  shareModalNote.revoked
                    ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400'
                }`}
              >
                {shareModalNote.revoked ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" /> Unrevoke Link
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" /> Revoke Link
                  </>
                )}
              </button>

              <button
                onClick={() => setShareModalNote(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold text-red-600 mb-2">Delete Note Permanently</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to permanently delete this note? This action cannot be undone and will remove all associated analytics and cached data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteNote(confirmDeleteId)}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
