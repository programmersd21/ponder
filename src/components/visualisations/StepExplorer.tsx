import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { VisualisationSpec } from '../../lib/schema.ts';

type StepSpec = Extract<VisualisationSpec, { type: 'step_explorer' }>;

export function StepExplorer({ spec }: { spec: StepSpec }) {
  const [stepIdx, setStepIdx] = useState(0);
  const total = spec.steps.length;
  const current = spec.steps[Math.min(stepIdx, total - 1)];

  return (
    <div className="space-y-5">
      {/* Progress Track */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[12px] font-mono text-[var(--muted-foreground)] tabular-nums">
          <span>
            Step {stepIdx + 1} of {total}
          </span>
          <span>{Math.round(((stepIdx + 1) / total) * 100)}%</span>
        </div>

        <div className="flex gap-1.5" role="tablist" aria-label="step selector">
          {spec.steps.map((step, idx) => {
            const active = idx === stepIdx;
            const completed = idx < stepIdx;
            return (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Step ${idx + 1}: ${step.title}`}
                onClick={() => setStepIdx(idx)}
                className={`h-2.5 flex-1 rounded-full transition-colors cursor-pointer ${
                  active
                    ? 'bg-[var(--accent)]'
                    : completed
                      ? 'bg-[var(--foreground)]/45'
                      : 'bg-[var(--surface-tertiary)] hover:bg-[var(--border-strong)]'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Current Step View */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-secondary)] p-4 sm:p-5 space-y-4">
        <div className="space-y-1.5">
          <div className="font-display text-lg font-semibold text-[var(--foreground)]">
            {current.title}
          </div>
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-[13px] text-[var(--accent)]">
            {current.operation}
          </div>
        </div>

        <p className="text-[14px] leading-relaxed text-[var(--foreground)]">
          {current.explanation}
        </p>

        {current.state.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {current.state.map((row, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between gap-3 rounded-[9px] border px-3 py-2 text-[13px] ${
                  row.highlight
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                    : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                <span className="text-[var(--muted-foreground)]">{row.label}</span>
                <span className="font-mono font-medium text-[var(--foreground)] tabular-nums text-right">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[9px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span>Previous</span>
          </button>
          <button
            type="button"
            disabled={stepIdx >= total - 1}
            onClick={() => setStepIdx((i) => Math.min(total - 1, i + 1))}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[9px] bg-[var(--primary)] px-3.5 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>Next step</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setStepIdx(0)}
          disabled={stepIdx === 0}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[9px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Restart</span>
        </button>
      </div>
    </div>
  );
}
