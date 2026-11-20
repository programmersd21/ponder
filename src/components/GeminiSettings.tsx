import React, { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, Loader2, Settings, Trash2, X } from 'lucide-react';
import { GeminiSetup } from './GeminiSetup.tsx';

type GeminiSettingsProps = {
  open: boolean;
  onClose: () => void;
  idToken?: string | null;
  onStatusChange?: () => void;
};

type Status = { configured: boolean; signedIn: boolean; accountStorage: boolean };

export function GeminiSettings({ open, onClose, idToken, onStatusChange }: GeminiSettingsProps) {
  const [status, setStatus] = useState<Status | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string>('');
  const [removing, setRemoving] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('ponder_model') || 'gemini-4-hydrogen');
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [replaceMsg, setReplaceMsg] = useState('');
  const [replaceStatus, setReplaceStatus] = useState<'idle'|'success'|'error'>('idle');
  const [serperStatus, setSerperStatus] = useState<{ configured: boolean } | null>(null);
  const [replaceSerperMode, setReplaceSerperMode] = useState(false);
  const [newSerperKey, setNewSerperKey] = useState('');
  const [showSerperKey, setShowSerperKey] = useState(false);
  const [replacingSerper, setReplacingSerper] = useState(false);
  const [replaceSerperMsg, setReplaceSerperMsg] = useState('');
  const [replaceSerperStatus, setReplaceSerperStatus] = useState<'idle'|'success'|'error'>('idle');

  const refresh = async () => {
    try {
      const [res, serperRes] = await Promise.all([fetch('/api/gemini/status'), fetch('/api/serper/status')]);
      const data = (await res.json()) as Status;
      const serperData = (await serperRes.json()) as { configured?: boolean };
      setStatus(data);
      setSerperStatus({ configured: Boolean(serperData.configured) });
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    if (open) {
      setReplaceMode(false);
      setTestMsg('');
      void refresh();
    }
  }, [open]);

  const handleTest = async () => {
    setTesting(true);
    setTestMsg('');
    try {
      const res = await fetch('/api/gemini/test', { method: 'POST' });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      setTestMsg(data.message || data.error || (res.ok ? 'Connected.' : 'Failed.'));
    } catch {
      setTestMsg('Network error.');
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await fetch('/api/gemini/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: idToken ?? undefined }),
      });
      await refresh();
      onStatusChange?.();
    } finally {
      setRemoving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="gemini settings">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-[16px] border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-elevated)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">gemini settings</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close settings" className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">Status</span>
              <span className={`font-medium ${status?.configured ? 'text-[var(--success)]' : 'text-[var(--destructive)]'}`}>
                {status?.configured ? 'Connected' : 'Not connected'}
              </span>
            </div>
            {status?.signedIn && (
              <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                Credential stored for your Google account.
              </div>
            )}
            {!status?.signedIn && status?.configured && (
              <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                Credential stored for this browser session only.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void handleTest()} disabled={testing || !status?.configured} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12.5px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-50 cursor-pointer">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              <span>Test connection</span>
            </button>
            <button type="button" onClick={() => setReplaceMode((v) => !v)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12.5px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer">
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{replaceMode ? 'Cancel' : 'Replace key'}</span>
            </button>
            <button type="button" onClick={() => void handleRemove()} disabled={removing || !status?.configured} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12.5px] font-medium text-[var(--destructive)] hover:bg-[var(--surface-secondary)] disabled:opacity-50 cursor-pointer">
              {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              <span>Remove</span>
            </button>
          </div>


          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <div className="flex items-center justify-between">
              <div className="text-[12.5px] font-medium text-[var(--muted-foreground)]">Serper</div>
              <span className={`text-[12px] font-medium ${serperStatus?.configured ? 'text-[var(--success)]' : 'text-[var(--destructive)]'}`}>
                {serperStatus?.configured ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setReplaceSerperMode((v) => !v)} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12.5px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer">
                <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{replaceSerperMode ? 'cancel' : 'replace serper key'}</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/serper/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: idToken ?? undefined }) });
                  void refresh();
                  onStatusChange?.();
                }}
                disabled={!serperStatus?.configured}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12.5px] font-medium text-[var(--destructive)] hover:bg-[var(--surface-secondary)] disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>remove</span>
              </button>
            </div>

            {replaceSerperMode && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2">
                  <input
                    type={showSerperKey ? 'text' : 'password'}
                    value={newSerperKey}
                    onChange={(e) => setNewSerperKey(e.target.value)}
                    placeholder="Paste new Serper API key"
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 bg-transparent text-[13px] text-[var(--foreground)] placeholder:text-[var(--subtle-foreground)] focus:outline-none"
                  />
                  <button type="button" onClick={() => setShowSerperKey((v) => !v)} aria-label={showSerperKey ? 'Hide key' : 'Show key'} className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer">
                    {showSerperKey ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const trimmed = newSerperKey.trim();
                    if (trimmed.length < 10) { setReplaceSerperStatus('error'); setReplaceSerperMsg('Enter a complete key.'); return; }
                    setReplacingSerper(true); setReplaceSerperMsg(''); setReplaceSerperStatus('idle');
                    try {
                      const res = await fetch('/api/serper/configure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: trimmed, idToken: idToken ?? undefined }) });
                      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
                      if (res.ok && data.ok) { setReplaceSerperStatus('success'); setReplaceSerperMsg(data.message || 'Connected.'); setNewSerperKey(''); void refresh(); onStatusChange?.(); setTimeout(() => setReplaceSerperMode(false), 800); }
                      else { setReplaceSerperStatus('error'); setReplaceSerperMsg(data.error || 'Could not connect.'); }
                    } catch { setReplaceSerperStatus('error'); setReplaceSerperMsg('Network error.'); }
                    finally { setReplacingSerper(false); }
                  }}
                  disabled={replacingSerper}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[8px] bg-[var(--primary)] px-3 text-[12.5px] font-medium text-[var(--primary-foreground)] disabled:opacity-50 cursor-pointer"
                >
                  {replacingSerper ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                  <span>connect</span>
                </button>
                {replaceSerperStatus === 'success' && <p className="text-[12.5px] font-medium text-[var(--success)]">{replaceSerperMsg}</p>}
                {replaceSerperStatus === 'error' && <p role="alert" className="text-[12.5px] text-[var(--destructive)]">{replaceSerperMsg}</p>}
              </div>
            )}
          </div>

          {testMsg && <p className="text-[12.5px] text-[var(--muted-foreground)]">{testMsg}</p>}

          {replaceMode && (
            <div className="border-t border-[var(--border)] pt-3 space-y-3">
              <div className="flex items-center gap-2 rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 focus-within:border-[var(--ring)]">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Paste new Gemini API key"
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 bg-transparent text-[13px] text-[var(--foreground)] placeholder:text-[var(--subtle-foreground)] focus:outline-none"
                />
                <button type="button" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Hide key' : 'Show key'} className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer">
                  {showKey ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const trimmed = newKey.trim();
                    if (trimmed.length < 20) { setReplaceStatus('error'); setReplaceMsg('Enter a complete key.'); return; }
                    setReplacing(true); setReplaceMsg(''); setReplaceStatus('idle');
                    try {
                      const res = await fetch('/api/gemini/configure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: trimmed, idToken: idToken ?? undefined }) });
                      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
                      if (res.ok && data.ok) { setReplaceStatus('success'); setReplaceMsg(data.message || 'Connected.'); setNewKey(''); void refresh(); onStatusChange?.(); setTimeout(() => setReplaceMode(false), 800); }
                      else { setReplaceStatus('error'); setReplaceMsg(data.error || 'Could not connect.'); }
                    } catch { setReplaceStatus('error'); setReplaceMsg('Network error.'); }
                    finally { setReplacing(false); }
                  }}
                  disabled={replacing}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[8px] bg-[var(--primary)] px-3 text-[12.5px] font-medium text-[var(--primary-foreground)] disabled:opacity-50 cursor-pointer"
                >
                  {replacing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                  <span>Connect</span>
                </button>
                <button type="button" onClick={() => setReplaceMode(false)} className="inline-flex min-h-[34px] items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12.5px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer">
                  Cancel
                </button>
              </div>
              {replaceStatus === 'success' && <p className="text-[12.5px] font-medium text-[var(--success)]">{replaceMsg}</p>}
              {replaceStatus === 'error' && <p role="alert" className="text-[12.5px] text-[var(--destructive)]">{replaceMsg}</p>}
            </div>
          )}

          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <div className="text-[12.5px] font-medium text-[var(--muted-foreground)]">Model</div>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                'gemini-4-hydrogen',
                'gemini-4-neon',
                'gemini-3.8-flash',
                'gemini-3.7-flash',
                'gemini-3.6-flash',
                'gemini-3.5-flash',
                'gemini-3.5-flash-lite',
                'gemini-2.5-flash',
                'gemini-2.5-flash-lite',
              ].map((m) => {
                const active = selectedModel === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { localStorage.setItem('ponder_model', m); setSelectedModel(m); }}
                    className={`flex items-center justify-between rounded-[8px] border px-3 py-2 text-left text-[12.5px] transition-colors cursor-pointer ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--foreground)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <span className="font-medium">{m}</span>
                    {active && <span className="text-[11px] text-[var(--accent)]">selected</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
