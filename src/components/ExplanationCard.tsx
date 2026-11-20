import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileDown,
  Headphones,
  Info,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pause,
  Play,
  Share2,
  Square,
  StickyNote,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { exportTurnAsPdf, formatExplanationForCopy } from '../lib/pdfExport.ts';
import { calculateReadingTime } from '../lib/readingTime.ts';
import type { ExplorationTurn } from '../lib/schema.ts';
import { soundEngine } from '../lib/soundEngine.ts';
import { buildSpeechText, type useTextToSpeech } from '../lib/useTextToSpeech.ts';
import { VisualisationRenderer } from './visualisations/VisualisationRenderer.tsx';
import { MathText } from './MathText.tsx';

type TtsController = ReturnType<typeof useTextToSpeech>;

type ExplanationCardProps = {
  turn: ExplorationTurn;
  turnIndex: number;
  isLatest: boolean;
  tts: TtsController;
  isSaved?: boolean;
  onToggleSave?: (turn: ExplorationTurn) => void;
  onShareTurn?: (turn: ExplorationTurn) => Promise<void>;
  shareStatus?: 'idle' | 'sharing' | 'copied' | 'needs_signin';
  onFollowUp?: (question: string) => void;
  onStartNew?: () => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  notesOpen?: boolean;
  onToggleNotes?: () => void;
  readOnly?: boolean;
};

const DEPTH_LABELS: Record<string, string> = {
  quick: 'Quick overview',
  standard: 'Standard',
  deep: 'Deep dive',
};

export function ExplanationCard({
  turn,
  turnIndex,
  isLatest,
  tts,
  isSaved = false,
  onToggleSave,
  onShareTurn,
  shareStatus = 'idle',
  onFollowUp,
  onStartNew,
  focusMode = false,
  onToggleFocusMode,
  notesOpen = false,
  onToggleNotes,
  readOnly = false,
}: ExplanationCardProps) {
  const { explanation } = turn;

  const [copiedText, setcopiedText] = useState(false);
  const [manualCopyText, setManualCopyText] = useState<string | null>(null);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [glossaryExpanded, setGlossaryExpanded] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [imageError, setImageError] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [exportMenuOpen]);

  const closeExportMenu = () => setExportMenuOpen(false);

  const readingTime = useMemo(() => calculateReadingTime(explanation), [explanation]);

  const isThisTurnSpeaking =
    tts.activeId === turn.id && (tts.status === 'speaking' || tts.status === 'paused');

  const handleListenClick = () => {
    soundEngine.play('ui.press', true);
    if (tts.activeId === turn.id && tts.status === 'speaking') {
      tts.pause();
    } else if (tts.activeId === turn.id && tts.status === 'paused') {
      tts.resume();
    } else {
      tts.speak(turn.id, buildSpeechText(explanation));
    }
  };

  const handleCopyExplanation = async () => {
    const cleanText = formatExplanationForCopy(turn);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cleanText);
        setcopiedText(true);
        soundEngine.play('feedback.success', true);
        setTimeout(() => setcopiedText(false), 2200);
        return;
      }
      throw new Error('Clipboard unavailable');
    } catch {
      setManualCopyText(cleanText);
    }
  };

  const handlePdfDownload = () => {
    soundEngine.play('feedback.success', true);
    exportTurnAsPdf(turn);
  };

  const handleSelectAnswer = (qIdx: number, optIdx: number, correctIdx: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
    if (optIdx === correctIdx) {
      soundEngine.play('learning.discovery', true);
    } else {
      soundEngine.play('ui.press', true);
    }
  };

  const citations = explanation.citations ?? [];
  const glossary = explanation.glossary ?? [];
  const checks = explanation.understandingChecks ?? [];
  const takeaways =
    explanation.keyTakeaways && explanation.keyTakeaways.length > 0
      ? explanation.keyTakeaways
      : [explanation.keyTakeaway];

  const generationMeta = explanation.generationMeta;
  const metaBadge = generationMeta?.fallbackUsed
    ? {
        kind: 'fallback' as const,
        label: 'Quick mode',
        detail: generationMeta.notice ?? 'Generated with a lighter model for speed.',
      }
    : generationMeta?.researchNote
      ? {
          kind: 'research' as const,
          label: 'Researched',
          detail: generationMeta.researchNote,
        }
      : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={turnIndex > 0 ? 'border-t border-[var(--border)] pt-12' : ''}
    >
      {/* Reading Column Header & Action Controls */}
      <div className="mx-auto max-w-[768px] space-y-5">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                {turnIndex === 0 ? 'Question' : `Follow-up ${turnIndex}`}
              </span>
              {readingTime.label && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)] tabular-nums">
                  {readingTime.label}
                </span>
              )}
              {explanation.depth && (
                <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                  {DEPTH_LABELS[explanation.depth] ?? explanation.depth}
                </span>
              )}
              {citations.length > 0 && (
                <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                  {citations.length} {citations.length === 1 ? 'source' : 'sources'}
                </span>
              )}
            </div>

            {!readOnly && turnIndex === 0 && onStartNew && (
              <button
                type="button"
                onClick={onStartNew}
                className="font-sans text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:underline underline-offset-4 cursor-pointer"
              >
                new topic
              </button>
            )}
          </div>

          <p className="border-l-2 border-[var(--accent)]/50 pl-4 text-[15px] font-medium leading-relaxed text-[var(--muted-foreground)]">
            “{turn.question}”
          </p>

          <h1 className="font-display text-[clamp(1.75rem,3.4vw,2.35rem)] font-semibold tracking-tight leading-[1.14] text-[var(--foreground)]">
            {explanation.title}
          </h1>

          {/* Compact Action Bar */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1" role="toolbar" aria-label="explanation actions">
            <button
              type="button"
              onClick={handleListenClick}
              disabled={!tts.isSupported}
              title={tts.isSupported ? 'listen to explanation aloud' : 'Audio playback not supported in this browser'}
              aria-label={
                isThisTurnSpeaking
                  ? tts.status === 'speaking'
                    ? 'pause audio listening'
                    : 'resume audio listening'
                  : 'listen to explanation'
              }
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-[8px] border px-2.5 text-[12.5px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                isThisTurnSpeaking
                  ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
              }`}
            >
              {isThisTurnSpeaking ? (
                tts.status === 'speaking' ? (
                  <>
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>resume</span>
                  </>
                )
              ) : (
                <>
                  <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>listen</span>
                </>
              )}
            </button>


            {!readOnly && onToggleSave && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('feedback.success', true);
                  onToggleSave(turn);
                }}
                aria-pressed={isSaved}
                title={isSaved ? 'Remove bookmark' : 'save exploration'}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-[8px] border px-2.5 text-[12.5px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSaved
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
                }`}
              >
                <Bookmark
                  className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`}
                  aria-hidden="true"
                />
                <span>{isSaved ? 'saved' : 'save'}</span>
              </button>
            )}

            {!readOnly && onToggleNotes && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.play(notesOpen ? 'ui.close' : 'ui.open', true);
                  onToggleNotes();
                }}
                aria-pressed={notesOpen}
                title="open private study notes for this thread"
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-[8px] border px-2.5 text-[12.5px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  notesOpen
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
                }`}
              >
                <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
                <span>notes</span>
              </button>
            )}

            {!readOnly && onToggleFocusMode && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('ui.toggle', true);
                  onToggleFocusMode();
                }}
                aria-pressed={focusMode}
                title={focusMode ? 'exit focus mode' : 'Distraction-free focus reading mode'}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-[8px] border px-2.5 text-[12.5px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  focusMode
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
                }`}
              >
                {focusMode ? (
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{focusMode ? 'exit focus' : 'focus'}</span>
              </button>
            )}

            <div ref={exportMenuRef} className="relative ml-auto">
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('ui.press', true);
                  setExportMenuOpen((v) => !v);
                }}
                aria-expanded={exportMenuOpen}
                aria-haspopup="menu"
                title="export and share options"
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-[8px] border px-2.5 text-[12.5px] font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  exportMenuOpen
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
                }`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                <span>export</span>
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${exportMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              <AnimatePresence>
                {exportMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 2, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    role="menu"
                    aria-label="export and share"
                    className="absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-[11px] border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-[var(--shadow-elevated)]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { closeExportMenu(); void handleCopyExplanation(); }}
                      className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)] cursor-pointer"
                    >
                      {copiedText ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />}
                      <span>{copiedText ? 'Copied!' : 'Copy text'}</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { closeExportMenu(); handlePdfDownload(); }}
                      className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)] cursor-pointer"
                    >
                      <FileDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                      <span>Download PDF</span>
                    </button>
                    {!readOnly && onShareTurn && (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={shareStatus === 'sharing'}
                        onClick={() => { closeExportMenu(); void onShareTurn(turn); }}
                        className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)] cursor-pointer disabled:opacity-50"
                      >
                        {shareStatus === 'copied' ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Share2 className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />}
                        <span>{shareStatus === 'copied' ? 'Link copied' : shareStatus === 'sharing' ? 'Sharing…' : 'Share link'}</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Active Speech Controller Drawer */}
          <AnimatePresence>
            {isThisTurnSpeaking && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5 text-[12.5px]"
              >
                <div className="flex items-center gap-2 text-[var(--foreground)]">
                  <Headphones className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
                  <span className="font-medium">
                    {tts.status === 'speaking' ? 'listening aloud' : 'Audio paused'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {tts.voices.length > 0 && (
                    <select
                      aria-label="select speech voice"
                      value={tts.selectedVoiceURI}
                      onChange={(e) => {
                        tts.setSelectedVoiceURI(e.target.value);
                      }}
                      className="max-w-[170px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--foreground)]"
                    >
                      {tts.voices.slice(0, 12).map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  )}

                  <select
                    aria-label="select playback speed"
                    value={tts.rate}
                    onChange={(e) => tts.setRate(Number(e.target.value))}
                    className="rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-[12px] text-[var(--foreground)]"
                  >
                    <option value={0.85}>0.85×</option>
                    <option value={1}>1.0×</option>
                    <option value={1.15}>1.15×</option>
                    <option value={1.3}>1.3×</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      tts.stop();
                      soundEngine.play('ui.press', true);
                    }}
                    aria-label="stop listening"
                    className="inline-flex min-h-[28px] items-center gap-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] cursor-pointer"
                  >
                    <Square className="h-3 w-3" aria-hidden="true" />
                    <span>Stop</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {tts.status === 'error' && tts.errorMessage && (
            <div role="status" className="text-[12.5px] text-[var(--destructive)]">
              {tts.errorMessage}
            </div>
          )}

          {/* Manual copy fallback if browser denied Clipboard API */}
          {manualCopyText && (
            <div className="space-y-2 rounded-[11px] border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
              <div className="flex items-center justify-between text-[12px] text-[var(--muted-foreground)]">
                <span>Clipboard access restricted , copy manually below:</span>
                <button
                  type="button"
                  onClick={() => setManualCopyText(null)}
                  className="font-medium text-[var(--foreground)] hover:underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
              <textarea
                readOnly
                value={manualCopyText}
                rows={4}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-[11.5px] text-[var(--foreground)]"
              />
            </div>
          )}

          {metaBadge && (
            <div className="group relative inline-flex">
              <span
                className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
                title={metaBadge.detail}
              >
                <Info className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
                {metaBadge.label}
              </span>
              <span className="sr-only">{metaBadge.detail}</span>
            </div>
          )}
        </header>

        {/* Direct Answer */}
        <p className="text-[17.5px] leading-[1.68] text-[var(--foreground)]">
          <MathText text={explanation.shortAnswer} />
        </p>

        {/* Real Sourced Educational Image (Wikimedia Commons) */}
        {explanation.media && !imageError && (
          <figure className="my-6 overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
            <img
              src={explanation.media.url}
              alt={explanation.media.alt}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="max-h-[380px] w-full object-cover bg-[var(--surface-secondary)]"
            />
            <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--border)] px-4 py-3 text-[12.5px] text-[var(--muted-foreground)]">
              <div className="min-w-0 space-y-0.5">
                <div className="font-medium text-[var(--foreground)]">
                  {explanation.media.caption}
                </div>
                <div className="text-[11.5px]">
                  <span>
                    {explanation.media.kind === 'sourced_image'
                      ? 'Sourced reference photograph'
                      : 'AI-generated educational illustration'}
                  </span>
                  {explanation.media.attribution && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>{explanation.media.attribution}</span>
                    </>
                  )}
                  {explanation.media.license && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>{explanation.media.license}</span>
                    </>
                  )}
                </div>
              </div>
              {explanation.media.sourceUrl && (
                <a
                  href={explanation.media.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline shrink-0"
                >
                  <span>Source</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </figcaption>
          </figure>
        )}

        {/* Structured Prose Sections */}
        <div className="space-y-6 pt-1">
          {explanation.sections.map((section, sIdx) => (
            <motion.section
              key={sIdx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: Math.min(sIdx * 0.05, 0.2), ease: [0.16, 1, 0.3, 1] }}
              className="space-y-2"
            >
              <h2 className="font-display text-[19.5px] font-semibold text-[var(--foreground)]">
                {section.heading}
              </h2>
              <p className="text-[15.5px] leading-[1.72] text-[var(--muted-foreground)] whitespace-pre-line">
                <MathText text={section.content} />
              </p>
            </motion.section>
          ))}
        </div>
      </div>

      {/* Wide Interactive Visualisation Stage */}
      {explanation.visualisation && (
        <div className="mx-auto mt-8 max-w-[940px]">
          <VisualisationRenderer spec={explanation.visualisation} />
        </div>
      )}

      {/* Key Takeaways, Glossary, Understanding Checks, sources & Follow-Ups */}
      <div className="mx-auto mt-8 max-w-[768px] space-y-6">
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-secondary)] px-5 py-4">
          <div className="font-mono text-[11px] font-medium text-[var(--accent)]">
            {takeaways.length > 1 ? 'key takeaways' : 'key takeaway'}
          </div>
          {takeaways.length === 1 ? (
            <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--foreground)]">
              <MathText text={takeaways[0]} />
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-[14.5px] leading-relaxed text-[var(--foreground)]">
              {takeaways.map((tk, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                  <span>{tk}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Concept Glossary */}
        {glossary.length > 0 && (
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => {
                setGlossaryExpanded((v) => !v);
                soundEngine.play(glossaryExpanded ? 'ui.close' : 'ui.open', true);
              }}
              aria-expanded={glossaryExpanded}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-[13.5px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)] rounded-[14px] transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
                <span>concept glossary ({glossary.length})</span>
              </span>
              {glossaryExpanded ? (
                <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              )}
            </button>

            <AnimatePresence>
              {glossaryExpanded && (
                <motion.dl
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="divide-y divide-[var(--border)] border-t border-[var(--border)] px-4"
                >
                  {glossary.map((item, idx) => (
                    <div key={idx} className="py-3 sm:grid sm:grid-cols-12 sm:gap-4">
                      <dt className="text-[13.5px] font-semibold text-[var(--foreground)] sm:col-span-4">
                        {item.term}
                      </dt>
                      <dd className="mt-0.5 text-[13.5px] leading-relaxed text-[var(--muted-foreground)] sm:col-span-8 sm:mt-0">
                        {item.definition}
                      </dd>
                    </div>
                  ))}
                </motion.dl>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Understanding Checks */}
        {checks.length > 0 && (
          <div className="space-y-3">
            <div className="text-[13px] font-medium text-[var(--muted-foreground)]">
              check your understanding
            </div>
            <div className="space-y-3">
              {checks.map((chk, qIdx) => {
                const chosen = selectedAnswers[qIdx];
                const hasChosen = chosen !== undefined;
                const isCorrect = hasChosen && chosen === chk.correctIndex;
                return (
                  <div
                    key={qIdx}
                    className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
                  >
                    <p className="text-[14.5px] font-medium text-[var(--foreground)]">
                      {chk.question}
                    </p>
                    <div className="space-y-1.5">
                      {chk.options.map((opt, optIdx) => {
                        const isThisSelected = chosen === optIdx;
                        const isRightOption = optIdx === chk.correctIndex;
                        let style =
                          'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] hover:border-[var(--border-strong)]';
                        if (hasChosen) {
                          if (isRightOption) {
                            style = 'border-[var(--success)] bg-[var(--accent-subtle)] text-[var(--foreground)]';
                          } else if (isThisSelected) {
                            style = 'border-[var(--warning)] bg-[var(--surface-tertiary)] text-[var(--foreground)]';
                          } else {
                            style = 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] opacity-75';
                          }
                        }
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectAnswer(qIdx, optIdx, chk.correctIndex)}
                            className={`flex w-full items-center justify-between gap-3 rounded-[9px] border px-3.5 py-2.5 text-left text-[13.5px] transition-colors cursor-pointer ${style}`}
                          >
                            <span>{opt}</span>
                            {hasChosen && isRightOption && (
                              <span className="font-mono text-[11px] font-medium text-[var(--success)] shrink-0">
                                Correct
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {hasChosen && (
                      <p className="text-[13px] leading-relaxed text-[var(--muted-foreground)] pt-0.5">
                        <span className="font-medium text-[var(--foreground)]">
                          {isCorrect ? 'Right , ' : 'Not quite , '}
                        </span>
                        {chk.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expandable sources Panel */}
        {citations.length > 0 && (
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => {
                setSourcesExpanded((v) => !v);
                soundEngine.play(sourcesExpanded ? 'ui.close' : 'ui.open', true);
              }}
              aria-expanded={sourcesExpanded}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-[13.5px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)] rounded-[14px] transition-colors cursor-pointer"
            >
              <span>sources ({citations.length})</span>
              {sourcesExpanded ? (
                <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              )}
            </button>

            <AnimatePresence>
              {sourcesExpanded && (
                <motion.ol
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="divide-y divide-[var(--border)] border-t border-[var(--border)] px-4"
                >
                  {citations.map((src, i) => (
                    <li key={src.id} className="py-3">
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start justify-between gap-3 text-left"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-[13.5px] font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] group-hover:underline">
                            {i + 1}. {src.title}
                          </div>
                          <div className="truncate font-mono text-[11.5px] text-[var(--muted-foreground)]">
                            {src.publisher ?? src.url}
                          </div>
                        </div>
                        <ExternalLink
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] group-hover:text-[var(--accent)]"
                          aria-hidden="true"
                        />
                      </a>
                    </li>
                  ))}
                </motion.ol>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Suggested Follow-Ups */}
        {!readOnly && isLatest && onFollowUp && explanation.suggestedFollowUps.length > 0 && (
          <div className="space-y-2.5 pt-1">
            <div className="text-[13px] font-medium text-[var(--muted-foreground)]">
              continue exploring
            </div>
            <div className="flex flex-wrap gap-2">
              {explanation.suggestedFollowUps.map((followUp) => (
                <button
                  key={followUp}
                  type="button"
                  onClick={() => {
                    soundEngine.play('ui.press', true);
                    onFollowUp(followUp);
                  }}
                  className="group inline-flex min-h-[38px] items-center gap-1.5 rounded-[9px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-left text-[13px] font-medium text-[var(--foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] hover:shadow-[var(--shadow-subtle)] cursor-pointer"
                >
                  <span>{followUp}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.article>
  );
}
