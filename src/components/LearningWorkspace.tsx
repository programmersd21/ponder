import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Lock,
  LogIn,
  RotateCcw,
  Square,
  StickyNote,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  type Explanation,
  type ExplorationDepth,
  type ExplorationThread,
  type ExplorationTurn,
  type ResearchMode,
  type SavedExplorationItem,
} from '../lib/schema.ts';
import { EXAMPLE_QUESTIONS } from '../lib/showcaseData.ts';
import { soundEngine } from '../lib/soundEngine.ts';
import { useTextToSpeech } from '../lib/useTextToSpeech.ts';
import { ExplanationCard } from './ExplanationCard.tsx';
import { MathText } from './MathText.tsx';
import { PonderLogo } from './PonderLogo.tsx';
import { QuestionComposer } from './QuestionComposer.tsx';
import { WorkspaceSidebar } from './WorkspaceSidebar.tsx';

type PartialStreamState = {
  question: string;
  stage: string;
  detail?: string;
  title?: string;
  shortAnswer?: string;
  sections?: { heading: string; content: string }[];
};

type StreamErrorState = {
  message: string;
  failedQuestion: string;
  category?: string;
  retryable?: boolean;
};

type LearningWorkspaceProps = {
  threads: ExplorationThread[];
  savedItems: SavedExplorationItem[];
  activeThread: ExplorationThread | null;
  activeThreadId: string | null;
  pendingQuestion: string | null;
  onConsumePendingQuestion: () => void;
  onSaveTurn: (turn: ExplorationTurn, targetThreadId: string | null) => Promise<string>;
  onSelectThread: (threadId: string) => void;
  onStartNewExploration: () => void;
  onRenameThread: (threadId: string, nextTitle: string) => Promise<void>;
  onTogglePin: (threadId: string, nextPinned: boolean) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
  onExportThreadPdf: (threadId: string) => void;
  onToggleSaveTurn: (turn: ExplorationTurn) => Promise<void>;
  onRemoveSaved: (savedId: string) => Promise<void>;
  onShareTurn: (
    turn: ExplorationTurn
  ) => Promise<{ url?: string; status: 'copied' | 'manual' | 'needs_signin' | 'error'; error?: string }>;
  noteContent: string;
  onSaveNote: (conversationId: string, content: string) => Promise<void>;
  sidebarOpen: boolean;
  onCloseSidebarMobile: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  depth: ExplorationDepth;
  onDepthChange: (depth: ExplorationDepth) => void;
  researchMode: ResearchMode;
  onResearchModeChange: (mode: ResearchMode) => void;
  user: User | null;
  authReady: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onDeleteAllData: () => Promise<void>;
  authError: string | null;
  composerInputRef: React.RefObject<HTMLTextAreaElement | null>;
  loadingThreadTurns?: boolean;
};

const TOPIC_FILTERS = [
  'All',
  'Astronomy',
  'Physics',
  'Calculus',
  'Algorithms',
  'Acoustics',
  'Optics',
] as const;

export function LearningWorkspace({
  threads,
  savedItems,
  activeThread,
  activeThreadId,
  pendingQuestion,
  onConsumePendingQuestion,
  onSaveTurn,
  onSelectThread,
  onStartNewExploration,
  onRenameThread,
  onTogglePin,
  onDeleteThread,
  onExportThreadPdf,
  onToggleSaveTurn,
  onRemoveSaved,
  onShareTurn,
  noteContent,
  onSaveNote,
  sidebarOpen,
  onCloseSidebarMobile,
  focusMode,
  onToggleFocusMode,
  depth,
  onDepthChange,
  researchMode,
  onResearchModeChange,
  user,
  authReady,
  onSignIn,
  onSignOut,
  onDeleteAllData,
  authError,
  composerInputRef,
  loadingThreadTurns = false,
}: LearningWorkspaceProps) {
  const [composerValue, setComposerValue] = useState('');
  const [followUpValue, setFollowUpValue] = useState('');
  const [topicFilter, setTopicFilter] = useState<string>('All');
  const [streaming, setStreaming] = useState<PartialStreamState | null>(null);
  const [errorState, setErrorState] = useState<StreamErrorState | null>(null);

  const [shareStatusByTurn, setShareStatusByTurn] = useState<
    Record<string, 'idle' | 'sharing' | 'copied' | 'needs_signin'>
  >({});
  const [shareBanner, setShareBanner] = useState<{
    kind: 'manual' | 'needs_signin' | 'error';
    url?: string;
    message: string;
  } | null>(null);

  const [notesOpen, setNotesOpen] = useState(false);
  const [draftNote, setDraftNote] = useState(noteContent);
  const [noteSaveState, setNoteSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [readProgress, setReadProgress] = useState(0);

  const tts = useTextToSpeech();
  const abortRef = useRef<AbortController | null>(null);
  const streamEndRef = useRef<HTMLDivElement>(null);

  // Sync draft note when active thread or loaded noteContent changes
  useEffect(() => {
    setDraftNote(noteContent);
    setNoteSaveState('idle');
  }, [activeThreadId, noteContent]);

  // Reset TTS & transient share alerts when switching threads
  useEffect(() => {
    tts.stop();
    setShareBanner(null);
    setNotesOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  // Track vertical reading progress on active thread
  useEffect(() => {
    if (!activeThread || activeThread.turns.length === 0) {
      setReadProgress(0);
      return;
    }

    const updateProgress = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 40) {
        setReadProgress(0);
        return;
      }
      const pct = Math.min(100, Math.max(0, Math.round((window.scrollY / scrollable) * 100)));
      setReadProgress(pct);
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, [activeThread]);

  const cancelStreaming = () => {
    if (!streaming) return;
    const q = streaming.question;
    const hadThread = Boolean(activeThread);
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(null);
    soundEngine.play('ui.close', true);
    if (hadThread) {
      setFollowUpValue(q);
    } else {
      setComposerValue(q);
    }
  };

  const submitQuestion = async (rawQuestion: string, isFollowUp = false) => {
    const question = rawQuestion.trim();
    if (question.length < 2 || streaming) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setErrorState(null);
    setShareBanner(null);
    if (isFollowUp) {
      setFollowUpValue('');
    } else {
      setComposerValue('');
    }

    setStreaming({
      question,
      stage: 'Thinking',
      detail: 'Connecting to ponder…',
    });

    const history = (activeThread?.turns ?? []).slice(-4).map((t) => ({
      question: t.question,
      title: t.explanation.title,
      shortAnswer: t.explanation.shortAnswer,
      visualisationType: t.explanation.visualisation?.type ?? null,
    }));

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.uid) {
        headers['x-ponder-uid'] = user.uid;
      }

      const response = await fetch('/api/explain', {
        method: 'POST',
        headers,
        body: JSON.stringify({ question, history, depth, researchMode, model: localStorage.getItem('ponder_model') || 'gemini-4-hydrogen' }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errMsg = 'Could not reach ponder right now.';
        let category: string | undefined;
        try {
          const data = (await response.json()) as { error?: string; category?: string };
          if (data.error) errMsg = data.error;
          category = data.category;
        } catch {
          // ignore
        }
        const err = new Error(errMsg) as Error & { category?: string; retryable?: boolean };
        err.category = category;
        err.retryable = response.status >= 500 || response.status === 429;
        throw err;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming response unavailable.');
      }

      const decoder = new TextDecoder();
      let sseBuffer = '';
      let completedExplanation: Explanation | null = null;
      let streamError: { message: string; category?: string; retryable?: boolean } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const rawEvents = sseBuffer.split('\n\n');
        sseBuffer = rawEvents.pop() ?? '';

        for (const rawEvent of rawEvents) {
          const lines = rawEvent.split('\n');
          let eventType = 'message';
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataStr += line.slice(5).trim();
            }
          }
          if (!dataStr) continue;

          try {
            const payload = JSON.parse(dataStr) as Record<string, unknown>;
            if (eventType === 'status' && typeof payload.stage === 'string') {
              setStreaming((prev) =>
                prev
                  ? {
                      ...prev,
                      stage: payload.stage as string,
                      detail: typeof payload.detail === 'string' ? payload.detail : prev.detail,
                    }
                  : prev
              );
            } else if (eventType === 'partial') {
              setStreaming((prev) =>
                prev
                  ? {
                      ...prev,
                      title: typeof payload.title === 'string' ? payload.title : prev.title,
                      shortAnswer:
                        typeof payload.shortAnswer === 'string'
                          ? payload.shortAnswer
                          : prev.shortAnswer,
                      sections: Array.isArray(payload.sections)
                        ? (payload.sections as { heading: string; content: string }[])
                        : prev.sections,
                    }
                  : prev
              );
            } else if (eventType === 'complete' && payload.explanation) {
              completedExplanation = payload.explanation as Explanation;
            } else if (eventType === 'error' && typeof payload.message === 'string') {
              streamError = {
                message: payload.message,
                category: typeof payload.category === 'string' ? payload.category : undefined,
                retryable: typeof payload.retryable === 'boolean' ? payload.retryable : true,
              };
            }
          } catch {
            // ignore malformed SSE chunk
          }
        }
      }

      if (streamError) {
        const err = new Error(streamError.message) as Error & {
          category?: string;
          retryable?: boolean;
        };
        err.category = streamError.category;
        err.retryable = streamError.retryable;
        throw err;
      }
      if (!completedExplanation) {
        throw new Error('The explanation stream ended unexpectedly. Please try again.');
      }

      const newTurn: ExplorationTurn = {
        id: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        question,
        explanation: completedExplanation,
        depth,
        createdAt: Date.now(),
      };

      await onSaveTurn(newTurn, activeThread?.id ?? null);
      setStreaming(null);
      soundEngine.play(
        completedExplanation.visualisation
          ? 'learning.visualization-ready'
          : 'learning.response'
      );
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      const typedErr = err as Error & { category?: string; retryable?: boolean };
      const msg =
        typedErr instanceof Error ? typedErr.message : 'Something went wrong. Please try again.';
      setStreaming(null);
      setErrorState({
        message: msg,
        failedQuestion: question,
        category: typedErr.category,
        retryable: typedErr.retryable ?? true,
      });
      soundEngine.play('feedback.error');
      if (isFollowUp) {
        setFollowUpValue(question);
      } else if (!activeThread) {
        setComposerValue(question);
      }
    }
  };

  useEffect(() => {
    if (pendingQuestion) {
      const q = pendingQuestion;
      onConsumePendingQuestion();
      void submitQuestion(q, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);

  useEffect(() => {
    if (streaming) {
      streamEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [streaming?.title, streaming?.shortAnswer]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleTurnShare = async (turn: ExplorationTurn) => {
    setShareStatusByTurn((prev) => ({ ...prev, [turn.id]: 'sharing' }));
    setShareBanner(null);
    const result = await onShareTurn(turn);

    if (result.status === 'copied') {
      setShareStatusByTurn((prev) => ({ ...prev, [turn.id]: 'copied' }));
      soundEngine.play('feedback.success', true);
      setTimeout(() => {
        setShareStatusByTurn((prev) => ({ ...prev, [turn.id]: 'idle' }));
      }, 2600);
    } else if (result.status === 'manual' && result.url) {
      setShareStatusByTurn((prev) => ({ ...prev, [turn.id]: 'idle' }));
      setShareBanner({
        kind: 'manual',
        url: result.url,
        message: 'Public read-only snapshot created. copy your share url below:',
      });
      soundEngine.play('feedback.success', true);
    } else if (result.status === 'needs_signin') {
      setShareStatusByTurn((prev) => ({ ...prev, [turn.id]: 'needs_signin' }));
      setShareBanner({
        kind: 'needs_signin',
        message:
          'sign in with Google to generate a persistent shareable link. Private notes stay strictly excluded from shares.',
      });
    } else {
      setShareStatusByTurn((prev) => ({ ...prev, [turn.id]: 'idle' }));
      setShareBanner({
        kind: 'error',
        message: result.error ?? 'Could not create share link right now.',
      });
      soundEngine.play('feedback.error', true);
    }
  };

  const handleSaveNoteSubmit = async () => {
    if (!activeThread) return;
    setNoteSaveState('saving');
    try {
      await onSaveNote(activeThread.id, draftNote);
      setNoteSaveState('saved');
      soundEngine.play('feedback.success', true);
      setTimeout(() => setNoteSaveState('idle'), 2000);
    } catch {
      setNoteSaveState('error');
      soundEngine.play('feedback.error', true);
    }
  };

  const filteredExamples =
    topicFilter === 'All'
      ? EXAMPLE_QUESTIONS
      : EXAMPLE_QUESTIONS.filter((e) => e.topic === topicFilter);

  const turns = activeThread?.turns ?? [];
  const lastTurn = turns[turns.length - 1];
  const savedTurnIds = new Set(savedItems.map((s) => s.turnId));

  return (
    <div className="flex min-h-[calc(100dvh-56px)]">
      {!focusMode && (
        <WorkspaceSidebar
          open={sidebarOpen}
          onCloseMobile={onCloseSidebarMobile}
          threads={threads}
          savedItems={savedItems}
          activeThreadId={activeThreadId}
          onSelectThread={onSelectThread}
          onNewExploration={onStartNewExploration}
          onRenameThread={onRenameThread}
          onTogglePin={onTogglePin}
          onDeleteThread={onDeleteThread}
          onExportPdf={onExportThreadPdf}
          onRemoveSaved={onRemoveSaved}
          user={user}
          authReady={authReady}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          onDeleteAllData={onDeleteAllData}
          authError={authError}
        />
      )}

      <div className="min-w-0 flex-1">
        {/* Reading Progress Bar for Active Thread */}
        {activeThread && turns.length > 0 && (
          <div
            className={`sticky ${focusMode ? "top-0" : "top-14"} z-20 h-[2px] w-full bg-transparent`}
            aria-hidden="true"
          >
            <div
              className="h-full bg-[var(--accent)] transition-[width] duration-150 ease-out"
              style={{ width: `${readProgress}%` }}
            />
          </div>
        )}

        {/* Discovery Screen */}
        {!activeThread && !streaming ? (
          <main className="mx-auto flex min-h-[calc(100dvh-56px)] max-w-[760px] flex-col justify-center px-4 py-8 sm:px-6 sm:py-10">
            <div className="space-y-6">
              <div className="space-y-2.5 text-left sm:text-center">
                <h1 className="font-display text-[clamp(1.9rem,4vw,2.65rem)] font-semibold tracking-tight leading-[1.12] text-[var(--foreground)]">
                  what are you curious about?
                </h1>
                <p className="text-[16px] text-[var(--muted-foreground)]">
                  ask anything. ponder pairs a clear explanation with an interactive model.
                </p>
              </div>

              <QuestionComposer
                value={composerValue}
                onChange={setComposerValue}
                onSubmit={(q) => void submitQuestion(q, false)}
                depth={depth}
                onDepthChange={onDepthChange}
                researchMode={researchMode}
                onResearchModeChange={onResearchModeChange}
                inputRef={composerInputRef}
              />

              {errorState && (
                <div
                  role="alert"
                  className="flex flex-col gap-3 rounded-[12px] border border-[var(--destructive)]/40 bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-2.5 text-[14px] text-[var(--foreground)]">
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--destructive)]"
                      aria-hidden="true"
                    />
                    <span>{errorState.message}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {errorState.retryable !== false && (
                      <button
                        type="button"
                        onClick={() => void submitQuestion(errorState.failedQuestion, false)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-secondary)] px-3 text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>try again</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setErrorState(null)}
                      aria-label="dismiss error"
                      className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[8px] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {/* Topic Filter & Functional Example Prompts */}
              <div className="space-y-3 pt-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[13px] font-medium text-[var(--muted-foreground)] shrink-0">
                    try an exploration
                  </span>
                  <div
                    className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0"
                    role="tablist"
                    aria-label="filter example topics"
                  >
                    {TOPIC_FILTERS.map((topic) => {
                      const active = topicFilter === topic;
                      return (
                        <button
                          key={topic}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => {
                            setTopicFilter(topic);
                            soundEngine.play('ui.toggle', true);
                          }}
                          className={`min-h-[32px] rounded-[7px] px-2.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? 'bg-[var(--surface-tertiary)] text-[var(--foreground)]'
                              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                          }`}
                        >
                          {topic}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {filteredExamples.map((item) => (
                    <button
                      key={item.question}
                      type="button"
                      onClick={() => {
                        soundEngine.play('ui.press', true);
                        setComposerValue(item.question);
                        void submitQuestion(item.question, false);
                      }}
                      className="group flex w-full items-center justify-between gap-4 py-3 px-2 text-left transition-colors duration-150 hover:bg-[var(--surface-secondary)] cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-[15px] font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                          {item.question}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                          <span>{item.topic}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[11px]">{item.modelHint}</span>
                        </div>
                      </div>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-[var(--subtle-foreground)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </main>
        ) : (
          /* Active Learning workspace */
          <main className="mx-auto max-w-[980px] px-4 pt-10 pb-12 sm:px-6 sm:pt-14 sm:pb-16">
            <div className="space-y-12">
              {loadingThreadTurns && turns.length === 0 && !streaming && (
                <div className="mx-auto flex max-w-[768px] items-center gap-3 py-10 text-sm text-[var(--muted-foreground)]">
                  <PonderLogo size={20} spinning />
                  <span>loading exploration from your workspace…</span>
                </div>
              )}

              {/* share Dialog / Guest Notice Banner */}
              <AnimatePresence>
                {shareBanner && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mx-auto max-w-[768px] rounded-[12px] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-subtle)]"
                    role="status"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium text-[var(--foreground)]">
                          {shareBanner.message}
                        </p>
                        {shareBanner.kind === 'manual' && shareBanner.url && (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={shareBanner.url}
                              onFocus={(e) => e.currentTarget.select()}
                              aria-label="share url"
                              className="h-9 min-w-0 flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-[12px] text-[var(--foreground)]"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                if (!shareBanner.url) return;
                                try {
                                  await navigator.clipboard?.writeText(shareBanner.url);
                                  soundEngine.play('feedback.success', true);
                                  setShareBanner(null);
                                } catch {
                                  // User can copy manually from input
                                }
                              }}
                              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[var(--primary)] px-3 text-[12px] font-medium text-[var(--primary-foreground)] cursor-pointer"
                            >
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>copy link</span>
                            </button>
                          </div>
                        )}
                        {shareBanner.kind === 'needs_signin' && (
                          <button
                            type="button"
                            onClick={() => {
                              setShareBanner(null);
                              void onSignIn();
                            }}
                            className="inline-flex min-h-[36px] items-center gap-2 rounded-[8px] bg-[var(--primary)] px-3.5 text-[12.5px] font-medium text-[var(--primary-foreground)] hover:opacity-90 cursor-pointer"
                          >
                            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>sign in with Google</span>
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShareBanner(null)}
                        aria-label="close share notice"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer shrink-0"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Private Study notes Panel */}
              <AnimatePresence>
                {notesOpen && activeThread && (
                  <motion.section
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    aria-label="private study notes"
                    className="mx-auto max-w-[768px] rounded-[14px] border border-[var(--border-strong)] bg-[var(--surface)] p-4 shadow-[var(--shadow-subtle)] space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StickyNote className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
                        <h2 className="font-display text-[15px] font-semibold text-[var(--foreground)]">
                          private study notes
                        </h2>
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--muted-foreground)]">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          <span>excluded from public shares</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotesOpen(false)}
                        aria-label="close private notes"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    <textarea
                      value={draftNote}
                      onChange={(e) => {
                        setDraftNote(e.target.value);
                        if (noteSaveState === 'saved') setNoteSaveState('idle');
                      }}
                      rows={4}
                      maxLength={10000}
                      placeholder="Jot down questions, intuitions, or summary notes for this exploration…"
                      className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-3 text-[14px] leading-relaxed text-[var(--foreground)] placeholder:text-[var(--subtle-foreground)] focus:border-[var(--ring)] focus:outline-none"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] text-[var(--muted-foreground)]">
                        {user
                          ? 'Synced privately to your Firestore notes'
                          : 'saved locally in this browser (Guest mode)'}
                      </span>
                      <div className="flex items-center gap-2">
                        {noteSaveState === 'saved' && (
                          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--success)]">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>saved</span>
                          </span>
                        )}
                        {noteSaveState === 'error' && (
                          <span className="text-[12px] text-[var(--destructive)]">
                            Could not save note
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleSaveNoteSubmit()}
                          disabled={noteSaveState === 'saving'}
                          className="inline-flex min-h-[34px] items-center rounded-[8px] bg-[var(--primary)] px-3.5 text-[12.5px] font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 cursor-pointer"
                        >
                          {noteSaveState === 'saving' ? 'Saving…' : 'save note'}
                        </button>
                      </div>
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Completed Explanation Turns */}
              {turns.map((turn, turnIndex) => {
                const isLatest = turnIndex === turns.length - 1 && !streaming;
                return (
                  <ExplanationCard
                    key={turn.id}
                    turn={turn}
                    turnIndex={turnIndex}
                    isLatest={isLatest}
                    tts={tts}
                    isSaved={savedTurnIds.has(turn.id)}
                    onToggleSave={(t) => void onToggleSaveTurn(t)}
                    onShareTurn={handleTurnShare}
                    shareStatus={shareStatusByTurn[turn.id] ?? 'idle'}
                    onFollowUp={(q) => void submitQuestion(q, true)}
                    onStartNew={onStartNewExploration}
                    focusMode={focusMode}
                    onToggleFocusMode={onToggleFocusMode}
                    notesOpen={notesOpen}
                    onToggleNotes={() => setNotesOpen((v) => !v)}
                  />
                );
              })}

              {/* Active Streaming Turn */}
              {streaming && (
                <article
                  aria-live="polite"
                  className={turns.length > 0 ? 'border-t border-[var(--border)] pt-12' : ''}
                >
                  <div className="mx-auto max-w-[768px] space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5 text-[13px] text-[var(--foreground)]">
                        <PonderLogo size={18} spinning />
                        <div>
                          <span className="font-medium">{streaming.stage}</span>
                          {streaming.detail && (
                            <span className="ml-2 text-[var(--muted-foreground)]">
                              · {streaming.detail}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={cancelStreaming}
                        className="inline-flex min-h-[30px] items-center gap-1.5 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] cursor-pointer shrink-0"
                      >
                        <Square className="h-3 w-3" aria-hidden="true" />
                        <span>cancel</span>
                      </button>
                    </div>

                    <p className="text-[15px] font-medium text-[var(--muted-foreground)]">
                      “{streaming.question}”
                    </p>

                    {streaming.title && (
                      <h2 className="font-display text-[clamp(1.75rem,3.4vw,2.35rem)] font-semibold tracking-tight leading-[1.15] text-[var(--foreground)]">
                        {streaming.title}
                      </h2>
                    )}

                    {streaming.shortAnswer && (
                      <p className="text-[17px] leading-[1.65] text-[var(--foreground)]">
                        <MathText text={streaming.shortAnswer} />
                      </p>
                    )}

                    {streaming.sections && streaming.sections.length > 0 && (
                      <div className="space-y-5 pt-2">
                        {streaming.sections.map((sec, idx) => (
                          <div key={idx} className="space-y-1.5">
                            <h3 className="font-display text-[19px] font-semibold text-[var(--foreground)]">
                              {sec.heading}
                            </h3>
                            {sec.content && (
                              <p className="text-[15px] leading-[1.7] text-[var(--muted-foreground)]">
                                <MathText text={sec.content} />
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!streaming.shortAnswer && (
                      <div className="space-y-3 pt-2" aria-hidden="true">
                        <div className="h-4 w-4/5 rounded bg-[var(--surface-tertiary)] animate-pulse" />
                        <div className="h-4 w-3/4 rounded bg-[var(--surface-tertiary)] animate-pulse" />
                        <div className="h-4 w-2/3 rounded bg-[var(--surface-tertiary)] animate-pulse" />
                      </div>
                    )}
                  </div>
                  <div ref={streamEndRef} />
                </article>
              )}

              {/* Inline Error for Follow-up */}
              {errorState && activeThread && (
                <div className="mx-auto max-w-[768px]">
                  <div
                    role="alert"
                    className="flex flex-col gap-3 rounded-[12px] border border-[var(--destructive)]/40 bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-2.5 text-[14px] text-[var(--foreground)]">
                      <AlertCircle
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--destructive)]"
                        aria-hidden="true"
                      />
                      <span>{errorState.message}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {errorState.retryable !== false && (
                        <button
                          type="button"
                          onClick={() => void submitQuestion(errorState.failedQuestion, true)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-secondary)] px-3 text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>retry</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setErrorState(null)}
                        aria-label="dismiss error"
                        className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[8px] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Persistent Follow-up Composer */}
              {activeThread && !streaming && (
                <div className="mx-auto max-w-[768px] border-t border-[var(--border)] pt-8">
                  <div className="mb-2.5 text-[13px] font-medium text-[var(--muted-foreground)]">
                    ask a follow-up about {lastTurn?.explanation.title.toLowerCase() ?? 'this topic'}
                  </div>
                  <QuestionComposer
                    value={followUpValue}
                    onChange={setFollowUpValue}
                    onSubmit={(q) => void submitQuestion(q, true)}
                    depth={depth}
                    onDepthChange={onDepthChange}
                    researchMode={researchMode}
                    onResearchModeChange={onResearchModeChange}
                    placeholder="ask why something happens, request an analogy, or test another angle…"
                    label="ask a follow-up question"
                    submitLabel="ask follow-up"
                    loading={Boolean(streaming)}
                    compact
                    inputRef={composerInputRef}
                  />
                </div>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
