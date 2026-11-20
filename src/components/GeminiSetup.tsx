import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';

type GeminiSetupProps = {
  idToken?: string | null;
  onConfigured: () => void;
};

type Status = 'idle' | 'validating' | 'success' | 'error';

export function GeminiSetup({ idToken, onConfigured }: GeminiSetupProps) {
  const [apiKey, setApiKey] = useState('');
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');
  const [serperKey, setSerperKey] = useState('');
  const [showSerper, setShowSerper] = useState(false);

  const handleConnect = async () => {
    const trimmed = apiKey.trim();
    if (trimmed.length < 20) {
      setStatus('error');
      setMessage('Enter a complete Gemini API key.');
      return;
    }
    setStatus('validating');
    setMessage('');
    try {
      const gRes = await fetch('/api/gemini/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed, idToken: idToken ?? undefined }),
      });
      const gData = (await gRes.json()) as { ok?: boolean; valid?: boolean; message?: string; error?: string; category?: string };
      if (!gRes.ok || !gData.ok) {
        setStatus('error');
        setMessage(gData.error || 'Could not connect Gemini key.');
        return;
      }

      const sKey = serperKey.trim();
      if (sKey.length < 10) {
        setStatus('error');
        setMessage('Please add a Serper API key as well.');
        return;
      }

      const sRes = await fetch('/api/serper/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: sKey, idToken: idToken ?? undefined }),
      });
      const sData = (await sRes.json()) as { ok?: boolean; valid?: boolean; message?: string; error?: string };
      if (!sRes.ok || !sData.ok) {
        setStatus('error');
        setMessage(sData.error || 'Could not connect Serper key.');
        return;
      }

      setStatus('success');
      setMessage('Gemini and Serper connected.');
      setApiKey('');
      setSerperKey('');
      setTimeout(() => onConfigured(), 600);
    } catch {
      setStatus('error');
      setMessage('Network error. Check your connection and try again.');
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-56px)] max-w-[560px] flex-col justify-center px-4 py-10">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] font-semibold tracking-tight leading-[1.1] text-[var(--foreground)]">
            connect your gemini api key
          </h1>
          <p className="text-[15px] leading-relaxed text-[var(--muted-foreground)]">
            ponder uses your own Gemini API access to generate explanations and interactive learning experiences. Your API usage is billed or limited according to your Google account's plan.
          </p>
        </div>

        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[40px] items-center gap-2 text-[14px] font-medium text-[var(--accent)] hover:underline underline-offset-4"
        >
          <span>get a gemini api key</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>

        <div className="space-y-3">
          <label htmlFor="gemini-key" className="text-[13px] font-medium text-[var(--muted-foreground)]">
            Gemini API key
          </label>
          <div className="flex items-center gap-2 rounded-[12px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2">
            <KeyRound className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
            <input
              id="gemini-key"
              type={show ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="paste your API key"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 bg-transparent text-[14px] text-[var(--foreground)] placeholder:text-[var(--subtle-foreground)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide API key' : 'Show API key'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] cursor-pointer"
            >
              {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="serper-key" className="text-[13px] font-medium text-[var(--muted-foreground)]">Serper API key</label>
              <a href="https://serper.dev/" target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-[var(--accent)] hover:underline">get a serper key</a>
            </div>
            <div className="flex items-center gap-2 rounded-[12px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 focus-within:border-[var(--ring)]">
              <KeyRound className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              <input
                id="serper-key"
                type={showSerper ? 'text' : 'password'}
                value={serperKey}
                onChange={(e) => setSerperKey(e.target.value)}
                placeholder="Paste your Serper API key"
                autoComplete="off"
                spellCheck={false}
                className="flex-1 bg-transparent text-[14px] text-[var(--foreground)] placeholder:text-[var(--subtle-foreground)] focus:outline-none"
              />
              <button type="button" onClick={() => setShowSerper((v) => !v)} aria-label={showSerper ? 'Hide key' : 'Show key'} className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer">
                {showSerper ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleConnect()}
            disabled={status === 'validating'}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--primary)] px-5 py-2.5 text-[15px] font-medium text-[var(--primary-foreground)] transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {status === 'validating' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Connecting...</span>
              </>
            ) : (
              <span>Connect</span>
            )}
          </button>

          {status === 'success' && (
            <p className="text-[13px] font-medium text-[var(--success)]">{message}</p>
          )}
          {status === 'error' && (
            <p role="alert" className="text-[13px] text-[var(--destructive)]">{message}</p>
          )}
        </div>

        <p className="text-[12px] leading-relaxed text-[var(--muted-foreground)]">
          Your key is validated with Gemini and stored only on the server. It is never shown again after saving.
        </p>
      </div>
    </main>
  );
}
