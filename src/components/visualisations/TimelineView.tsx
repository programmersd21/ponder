import React, { useState } from 'react';
import type { VisualisationSpec } from '../../lib/schema.ts';

type TimelineSpec = Extract<VisualisationSpec, { type: 'timeline' }>;

export function TimelineView({ spec }: { spec: TimelineSpec }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = spec.events[Math.min(selectedIdx, spec.events.length - 1)];

  return (
    <div className="space-y-5">
      {/* Interactive chronological selector */}
      <div className="relative">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {spec.events.map((ev, idx) => {
            const active = idx === selectedIdx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                aria-pressed={active}
                className={`flex flex-col items-start rounded-[11px] border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]'
                }`}
              >
                <span className="font-mono text-[11px] font-medium text-[var(--muted-foreground)]">
                  {ev.date}
                </span>
                <span className="mt-1 text-[14px] font-medium leading-snug text-[var(--foreground)]">
                  {ev.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Event Details */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-secondary)] p-4 sm:p-5 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-mono text-[var(--muted-foreground)]">
          <span>{selected.date}</span>
          <span aria-hidden="true">·</span>
          <span>
            Milestone {selectedIdx + 1} of {spec.events.length}
          </span>
        </div>
        <h4 className="font-display text-lg font-semibold text-[var(--foreground)]">
          {selected.title}
        </h4>
        <p className="text-[14px] leading-relaxed text-[var(--foreground)]">
          {selected.summary}
        </p>
        {selected.significance && (
          <p className="pt-1 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
            Why it mattered: {selected.significance}
          </p>
        )}
      </div>
    </div>
  );
}
