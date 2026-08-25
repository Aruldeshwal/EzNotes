'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AccessType, ShareType } from '@prisma/client';
import { SanitizedViewer } from './SanitizedViewer';
import { Lock, AlertTriangle, ShieldAlert, Clock, Edit3 } from 'lucide-react';

interface ShareNoteData {
  id: string;
  token: string;
  title: string;
  content: string;
  shareType: ShareType;
  accessType: AccessType;
  expiryDate?: string | null;
  revoked?: boolean;
  consumedAt?: string | null;
}

interface ShareViewerMachineProps {
  token: string;
  initialNote?: ShareNoteData | null;
  isOwner?: boolean;
}

export const ShareViewerMachine: React.FC<ShareViewerMachineProps> = ({
  token,
  initialNote,
  isOwner,
}) => {
  const [note, setNote] = useState<ShareNoteData | null>(initialNote || null);
  const [loading, setLoading] = useState(!initialNote);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [consumedAt, setConsumedAt] = useState<string | null>(null);

  // Password Gateway State
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isConsumedLocally, setIsConsumedLocally] = useState(false);

  // Collaborative Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // Fetch note details
  const fetchNote = useCallback(async () => {
    try {
      const res = await fetch(`/api/share/${token}`);
      if (res.status === 404) {
        setErrorStatus(404);
      } else if (res.status === 410) {
        if (!isConsumedLocally) {
          const body = await res.json();
          setErrorStatus(410);
          setConsumedAt(body.consumedAt || null);
        }
      } else if (res.status === 401) {
        if (!isUnlocked) {
          setErrorStatus(401);
        }
      } else if (res.ok) {
        const data: ShareNoteData = await res.json();
        setNote(data);
        setEditedContent(data.content || '');
        if (data.content) {
          setIsUnlocked(true);
        }
        setErrorStatus(null);
      }
    } catch {
      setErrorStatus(500);
    } finally {
      setLoading(false);
    }
  }, [token, isConsumedLocally, isUnlocked]);

  useEffect(() => {
    let isMounted = true;
    if (!initialNote) {
      fetch(`/api/share/${token}`).then(async (res) => {
        if (!isMounted) return;
        if (res.status === 404) {
          setErrorStatus(404);
        } else if (res.status === 410) {
          const body = await res.json();
          setErrorStatus(410);
          setConsumedAt(body.consumedAt || null);
        } else if (res.status === 401) {
          setErrorStatus(401);
        } else if (res.ok) {
          const data: ShareNoteData = await res.json();
          setNote(data);
          setEditedContent(data.content);
          setErrorStatus(null);
        }
        setLoading(false);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [initialNote, token]);

  // Client-side polling for collaborative notes per architecture.md §5.5 (every 4s)
  useEffect(() => {
    if (
      note?.shareType === ShareType.COLLABORATIVE &&
      note?.accessType !== AccessType.ONE_TIME &&
      !isEditing
    ) {
      const interval = setInterval(() => {
        fetchNote();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [note?.shareType, note?.accessType, isEditing, fetchNote]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds !== null && lockoutSeconds > 0) {
      const timer = setInterval(() => {
        setLockoutSeconds((prev) => (prev && prev > 1 ? prev - 1 : null));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutSeconds]);

  // Password submission handler
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setIsVerifyingPassword(true);

    try {
      const res = await fetch(`/api/share/${token}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const body = await res.json();
        setNote(body.data);
        setEditedContent(body.data.content || '');
        setIsUnlocked(true);
        setErrorStatus(null);
      } else if (res.status === 403) {
        setPasswordError('Too many failed attempts. Locked out for 15 minutes.');
        setLockoutSeconds(900);
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
    } catch {
      setPasswordError('Failed to connect to server. Please try again.');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  // One-Time Consume handler
  const handleConsumeOneTime = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/share/${token}/consume-one-time`, {
        method: 'POST',
      });

      if (res.ok) {
        const body = await res.json();
        setNote(body.data);
        setEditedContent(body.data.content || '');
        setIsConsumedLocally(true);
        setErrorStatus(null);
      } else {
        setErrorStatus(410);
        setConsumedAt(new Date().toISOString());
      }
    } catch {
      setErrorStatus(500);
    } finally {
      setLoading(false);
    }
  };

  // Collaborative Patch handler
  const handleSaveCollabPatch = async () => {
    if (!note) return;
    const res = await fetch(`/api/share/${token}/content`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editedContent }),
    });

    if (res.ok) {
      setNote({ ...note, content: editedContent });
      setIsEditing(false);
    } else {
      alert('Failed to save edit.');
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
      </div>
    );
  }

  // 2. Not Found (404) State
  if (errorStatus === 404) {
    return (
      <div className="max-w-md mx-auto p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Note Not Found
        </h2>
        <p className="text-sm text-slate-500">
          The share link is invalid or may have been deleted by the owner.
        </p>
      </div>
    );
  }

  // 3. Gone (410) State — Distinguishes Revoked vs Consumed
  if (!isConsumedLocally && (errorStatus === 410 || note?.revoked)) {
    const isConsumed = Boolean(consumedAt || note?.consumedAt);
    return (
      <div className="max-w-md mx-auto p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="w-12 h-12 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {isConsumed ? 'One-Time Note Already Viewed' : 'Link Revoked'}
        </h2>
        <p className="text-sm text-slate-500">
          {isConsumed
            ? 'This one-time note has already been viewed and destroyed by design.'
            : 'The owner has manually revoked access to this share link.'}
        </p>
      </div>
    );
  }

  // 4. Expired State
  if (note?.expiryDate && new Date(note.expiryDate) < new Date()) {
    return (
      <div className="max-w-md mx-auto p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Note Expired</h2>
        <p className="text-sm text-slate-500">
          This note expired on {new Date(note.expiryDate).toLocaleString()}.
        </p>
      </div>
    );
  }

  // 5. Password Gateway State
  if (
    !isUnlocked &&
    (errorStatus === 401 || (note?.accessType === AccessType.PASSWORD && !note.content))
  ) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-center text-slate-900 dark:text-slate-100 mb-1">
          Password Protected Note
        </h2>
        <p className="text-xs text-center text-slate-500 mb-6">
          Enter the password provided by the note owner to gain access.
        </p>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {passwordError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-xs rounded-lg">
              {passwordError}
              {lockoutSeconds && (
                <div className="font-mono mt-1 font-semibold">
                  Try again in {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s
                </div>
              )}
            </div>
          )}

          <div>
            <input
              type="password"
              placeholder="Enter note password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={Boolean(lockoutSeconds)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={Boolean(lockoutSeconds) || isVerifyingPassword}
            className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isVerifyingPassword ? 'Unlocking...' : 'Unlock Note'}
          </button>
        </form>
      </div>
    );
  }

  // 6. One-Time View Gateway Prompt (if not yet consumed)
  if (!isConsumedLocally && note?.accessType === AccessType.ONE_TIME) {
    return (
      <div className="max-w-md mx-auto p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="w-12 h-12 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          One-Time Self-Destruct Note
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Viewing this note will immediately consume the link. It cannot be opened a second time.
        </p>

        <button
          onClick={handleConsumeOneTime}
          disabled={loading}
          className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? 'Consuming Note...' : 'View Note Now'}
        </button>
      </div>
    );
  }

  // 7. Content View State
  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{note?.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {note?.shareType === ShareType.COLLABORATIVE
                ? 'Collaborative Note'
                : 'Read-Only Note'}
            </span>
            {isOwner && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                You are the Owner
              </span>
            )}
          </div>
        </div>

        {note?.shareType === ShareType.COLLABORATIVE && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" /> {isEditing ? 'Cancel Editing' : 'Edit Note'}
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            rows={12}
            className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-sm focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handleSaveCollabPatch}
              className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs rounded-lg"
            >
              Save Edits
            </button>
          </div>
        </div>
      ) : (
        <SanitizedViewer content={note?.content || ''} />
      )}
    </div>
  );
};
