'use client';

import React, { useState } from 'react';
import { Note, AccessType, ShareType } from '@prisma/client';
import Link from 'next/link';
import { ExternalLink, Lock, Eye, Trash2, ShieldAlert, Clock, CheckCircle } from 'lucide-react';
import { revokeNote } from '@/lib/actions/notes';

interface NotesTableProps {
  initialNotes: Note[];
}

export const NotesTable: React.FC<NotesTableProps> = ({ initialNotes }) => {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const handleRevoke = async (id: string) => {
    const res = await revokeNote(id);
    if (res.success) {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, revoked: true } : n)),
      );
      setConfirmRevokeId(null);
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
    <div className="overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
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
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors tab-focusable"
                  tabIndex={0}
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
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                        Revoked {note.consumedAt ? '(Consumed)' : ''}
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
                  <td className="px-6 py-4 text-right space-x-2">
                    <a
                      href={`/share/${note.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                      title="View Share Link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {!note.revoked && (
                      <button
                        onClick={() => setConfirmRevokeId(note.id)}
                        className="inline-flex items-center p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                        title="Revoke Note Link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {confirmRevokeId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold mb-2">Revoke Link</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to revoke this note share link? Readers will no longer be able to view it.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmRevokeId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(confirmRevokeId)}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Confirm Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
