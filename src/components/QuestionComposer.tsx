import React, { useEffect, useId, useRef } from 'react';
import { ArrowUp, Globe, Loader2 } from 'lucide-react';
import type { ExplorationDepth, ResearchMode } from '../lib/schema.ts';
import { soundEngine } from '../lib/soundEngine.ts';

type QuestionComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (question: string) => void;
  depth?: ExplorationDepth;
  onDepthChange?: (depth: ExplorationDepth) => void;
  researchMode?: ResearchMode;
  onResearchModeChange?: (mode: ResearchMode) => void;
  placeholder?: string;
  label?: string;
  submitLabel?: string;
  loading?: boolean;
  compact?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
};

const DEPTH_OPTIONS: { id: ExplorationDepth; label: string }[] = [
  { id: 'quick', label: 'Quick' },
  { id: 'standard', label: 'Standard' },
  { id: 'deep', label: 'Deep dive' },
];

const RESEARCH_OPTIONS: { id: ResearchMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'always', label: 'Research' },
  { id: 'off', label: 'Off' },
];

export function QuestionComposer({
  value,
  onChange,
  onSubmit,
  depth = 'standard',
  onDepthChange,
  researchMode = 'auto',
  onResearchModeChange,
  placeholder = 'ask something you’ve always wanted to truly understand…',
  label = 'ask a question to explore',
  submitLabel = 'explore',
  loading = false,
  compact = false,
  inputRef: externalRef,
}: QuestionComposerProps) {
  const inputId = useId();
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef ?? internalRef;

  const trimmed = value.trim();
  const tooLong = value.length > 1000;
  const canSubmit = trimmed.length >= 2 && !tooLong && !loading;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minH = compact ? 48 : 80;
    const maxH = compact ? 160 : 220;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minH), maxH)}px`;
  }, [value, compact, textareaRef]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) {
        soundEngine.play('ui.press', true);
        onSubmit(trimmed);
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      soundEngine.play('ui.press', true);
      onSubmit(trimmed);
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="w-full">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div
        className={`group rounded-[14px] border bg-[var(--surface)] shadow-[var(--shadow-subtle)] transition-colors duration-150 ${
          tooLong ? 'border-[var(--destructive)]' : 'border-[var(--border-strong)]'
        } ${compact ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'}`}
      >
        <textarea
          ref={textareaRef}
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          rows={compact ? 1 : 2}
          aria-invalid={tooLong}
          className={`w-full resize-none bg-transparent text-[var(--foreground)] placeholder:text-[var(--subtle-foreground)] focus:outline-none disabled:opacity-60 ${
            compact ? 'px-1.5 py-1 text-[15px] leading-relaxed' : 'px-1 py-1 text-[16px] leading-relaxed'
          }`}
        />

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--border)]/70 pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {onDepthChange && (
              <div
                role="group"
                aria-label="explanation depth"
                className="inline-flex items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-secondary)] p-0.5"
              >
                {DEPTH_OPTIONS.map((opt) => {
                  const active = depth === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        onDepthChange(opt.id);
                        soundEngine.play('ui.toggle', true);
                      }}
                      aria-pressed={active}
                      className={`min-h-[28px] rounded-[6px] px-2.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                        active
                          ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm'
                          : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {onResearchModeChange && (
              <div
                role="group"
                aria-label="web research mode"
                className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface-secondary)] p-0.5"
                title="web research mode: Auto searches current sources when helpful"
              >
                <span className="inline-flex items-center gap-1 pl-2 pr-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                  <Globe className="h-3 w-3" aria-hidden="true" />
                  <span className="hidden sm:inline">Web</span>
                </span>
                {RESEARCH_OPTIONS.map((opt) => {
                  const active = researchMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        onResearchModeChange(opt.id);
                        soundEngine.play('ui.toggle', true);
                      }}
                      aria-pressed={active}
                      className={`min-h-[28px] rounded-[6px] px-2 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                        active
                          ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm'
                          : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {value.length > 750 && (
              <span
                className={`font-mono text-[12px] tabular-nums ${
                  tooLong ? 'font-medium text-[var(--destructive)]' : 'text-[var(--muted-foreground)]'
                }`}
              >
                {value.length}/1000
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            aria-label={loading ? 'Generating explanation' : submitLabel}
            className="ml-auto inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-2 rounded-[9px] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer shrink-0 whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Thinking…</span>
              </>
            ) : (
              <>
                <span>{submitLabel}</span>
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
