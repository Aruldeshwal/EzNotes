'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AccessType, ShareType, Note } from '@prisma/client';
import { createNote, updateNote, regeneratePassword } from '@/lib/actions/notes';
import { TimezonePicker } from './TimezonePicker';
import { Lock, Copy, Check, RefreshCw, KeyRound, Sparkles } from 'lucide-react';

interface NoteEditorProps {
  initialNote?: Note;
}

const MAX_CHARS = 100_000;

export const NoteEditor: React.FC<NoteEditorProps> = ({ initialNote }) => {
  const router = useRouter();
  const isEditing = Boolean(initialNote);

  const [title, setTitle] = useState(initialNote?.title || '');
  const [content, setContent] = useState(initialNote?.content || '');
  const [shareType, setShareType] = useState<ShareType>(initialNote?.shareType || ShareType.READ_ONLY);
  const [accessType, setAccessType] = useState<AccessType>(initialNote?.accessType || AccessType.PUBLIC);
  const [expiryDate, setExpiryDate] = useState<string>(
    initialNote?.expiryDate ? new Date(initialNote.expiryDate).toISOString() : '',
  );
  const [password, setPassword] = useState<string>('');

  // Password plaintext held ONLY in local component state — cleared on unmount
  const [generatedPlaintext, setGeneratedPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clear plaintext password from state on unmount
  useEffect(() => {
    return () => {
      setGeneratedPlaintext(null);
    };
  }, []);

  // 2000ms debounced autosave for editing existing note
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!isEditing || isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      if (!initialNote?.id) return;
      setSaving(true);
      await updateNote({
        id: initialNote.id,
        title,
        content,
        shareType,
        accessType,
        expiryDate: expiryDate || null,
      });
      setSaving(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [title, content, shareType, accessType, expiryDate, isEditing, initialNote?.id]);

  const handleGeneratePassword = () => {
    // Generate random 12-char password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
    setGeneratedPlaintext(res);
    setAccessType(AccessType.PASSWORD);
  };

  const handleCopyPassword = () => {
    if (generatedPlaintext) {
      navigator.clipboard.writeText(generatedPlaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegeneratePasswordClick = async () => {
    if (!initialNote?.id) return;
    if (confirm('Regenerating password will invalidate the previous one. Continue?')) {
      const res = await regeneratePassword(initialNote.id);
      if (res.success) {
        setGeneratedPlaintext(res.data.plaintext);
        setAccessType(AccessType.PASSWORD);
      } else {
        setErrorMessage(res.error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSaving(true);

    if (isEditing && initialNote) {
      const res = await updateNote({
        id: initialNote.id,
        title,
        content,
        shareType,
        accessType,
        expiryDate: expiryDate || null,
      });

      setSaving(false);
      if (res.success) {
        router.push('/notes');
      } else {
        setErrorMessage(res.error);
      }
    } else {
      const res = await createNote({
        title,
        content,
        shareType,
        accessType,
        expiryDate: expiryDate || null,
        password: password || undefined,
      });

      setSaving(false);
      if (res.success) {
        router.push('/notes');
      } else {
        setErrorMessage(res.error);
      }
    }
  };

  const charCount = content.length;
  const isNearLimit = charCount >= 95_000;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor Body */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <input
              type="text"
              placeholder="Note Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full text-2xl font-bold bg-transparent border-b border-slate-200 dark:border-slate-800 pb-2 focus:outline-none focus:border-slate-900 dark:focus:border-slate-100"
            />
          </div>

          <div className="relative">
            <textarea
              placeholder="Write your note content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100"
            />
            {/* Live Character Counter */}
            <div
              className={`text-right text-xs font-mono mt-1 ${
                isNearLimit ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400'
              }`}
            >
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
            </div>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl space-y-6 shadow-sm h-fit">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 border-b pb-2">
            Sharing & Access
          </h3>

          {/* Access Type */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Access Restriction
            </label>
            <select
              value={accessType}
              onChange={(e) => setAccessType(e.target.value as AccessType)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none"
            >
              <option value={AccessType.PUBLIC}>Public (Anyone with link)</option>
              <option value={AccessType.PASSWORD}>Password Protected</option>
              <option value={AccessType.ONE_TIME}>One-Time View (Self-destruct)</option>
            </select>
          </div>

          {/* Share Type */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Permissions
            </label>
            <select
              value={shareType}
              onChange={(e) => setShareType(e.target.value as ShareType)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none"
            >
              <option value={ShareType.READ_ONLY}>Read-Only</option>
              <option value={ShareType.COLLABORATIVE}>Collaborative (Allow Edits)</option>
            </select>
          </div>

          {/* Expiration Picker */}
          <TimezonePicker value={expiryDate} onChange={setExpiryDate} />

          {/* Password UI */}
          {(accessType === AccessType.PASSWORD || password || generatedPlaintext) && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-500" /> Password Protection
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Generate
                </button>
              </div>

              {!isEditing && (
                <input
                  type="password"
                  placeholder="Enter or generate password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                />
              )}

              {isEditing && (
                <button
                  type="button"
                  onClick={handleRegeneratePasswordClick}
                  className="w-full px-3 py-2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded-md flex items-center justify-center gap-2 hover:bg-amber-100"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate Password
                </button>
              )}

              {generatedPlaintext && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md space-y-1">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" /> Plaintext Password (temporary)
                  </p>
                  <div className="flex items-center justify-between font-mono text-sm font-bold text-amber-900 dark:text-amber-100">
                    <span>{generatedPlaintext}</span>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="p-1 text-amber-700 hover:text-amber-900 dark:text-amber-400"
                      title="Copy to Clipboard"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    Held only in local state. Cleared on navigate/unmount.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create & Share Note'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
