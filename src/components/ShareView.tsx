import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Lock } from 'lucide-react';
import { fetchPublicShareSnapshot } from '../lib/firestoreStore.ts';
import type { ExplorationTurn, SharedSnapshot } from '../lib/schema.ts';
import { useTextToSpeech } from '../lib/useTextToSpeech.ts';
import { ExplanationCard } from './ExplanationCard.tsx';
import { PonderLogo } from './PonderLogo.tsx';

type ShareViewProps = {
  shareId: string;
  onExitShare: () => void;
};

export function ShareView({ shareId, onExitShare }: ShareViewProps) {
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);
  const tts = useTextToSpeech();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorState(null);

    fetchPublicShareSnapshot(shareId)
      .then((res) => {
        if (!active) return;
        if (res.status === 'found' && res.snapshot) {
          setSnapshot(res.snapshot);
        } else if (res.status === 'invalid') {
          setErrorState('This share link format is invalid.');
        } else if (res.status === 'version_mismatch') {
          setErrorState('This shared snapshot uses an unsupported format version.');
        } else {
          setErrorState('This shared exploration was removed or does not exist.');
        }
      })
      .catch(() => {
        if (!active) return;
        setErrorState('Could not load this shared exploration right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [shareId]);

  const turn: ExplorationTurn | null = snapshot
    ? {
        id: snapshot.id,
        question: snapshot.question,
        explanation: snapshot.explanation,
        createdAt: snapshot.createdAt,
      }
    : null;

  return (
    <main className="mx-auto max-w-[980px] px-4 py-8 sm:px-6 sm:py-12">
      {/* Subtle read-only notice banner */}
      <div className="mx-auto mb-8 flex max-w-[740px] flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 text-[12.5px]">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <Lock className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
          <span>shared exploration · read-only snapshot</span>
        </div>
        <button
          type="button"
          onClick={onExitShare}
          className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline underline-offset-4 cursor-pointer"
        >
          <span>open ponder workspace</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {loading && (
        <div className="mx-auto flex max-w-[740px] items-center gap-3 py-12 text-sm text-[var(--muted-foreground)]">
          <PonderLogo size={20} spinning />
          <span>Loading shared exploration…</span>
        </div>
      )}

      {!loading && errorState && (
        <div className="mx-auto max-w-[540px] space-y-4 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--destructive)]" aria-hidden="true" />
            <div className="space-y-1">
              <h1 className="font-display text-lg font-semibold text-[var(--foreground)]">
                shared exploration unavailable
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">{errorState}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onExitShare}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[9px] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 cursor-pointer"
          >
            <span>explore a new question</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {!loading && turn && (
        <ExplanationCard turn={turn} turnIndex={0} isLatest={false} tts={tts} readOnly />
      )}
    </main>
  );
}
