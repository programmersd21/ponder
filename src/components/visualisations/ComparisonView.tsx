import React, { useState } from 'react';
import type { VisualisationSpec } from '../../lib/schema.ts';

type ComparisonSpec = Extract<VisualisationSpec, { type: 'comparison' }>;

export function ComparisonView({ spec }: { spec: ComparisonSpec }) {
  const [focusedItemIdx, setFocusedItemIdx] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-[var(--muted-foreground)] mr-1">Highlight:</span>
        <button
          type="button"
          onClick={() => setFocusedItemIdx(null)}
          className={`min-h-[34px] rounded-[8px] border px-2.5 text-[12px] font-medium transition-colors cursor-pointer ${
            focusedItemIdx === null
              ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--foreground)]'
              : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          All
        </button>
        {spec.items.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setFocusedItemIdx(focusedItemIdx === idx ? null : idx)}
            className={`min-h-[34px] rounded-[8px] border px-2.5 text-[12px] font-medium transition-colors cursor-pointer ${
              focusedItemIdx === idx
                ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--foreground)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Desktop / Tablet Matrix */}
      <div className="hidden sm:block overflow-x-auto rounded-[12px] border border-[var(--border)]">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)]">
              <th className="px-4 py-3 font-medium text-[var(--muted-foreground)] w-1/4">
                Dimension
              </th>
              {spec.items.map((item, idx) => (
                <th
                  key={idx}
                  className={`px-4 py-3 font-display text-[14px] font-semibold transition-opacity ${
                    focusedItemIdx !== null && focusedItemIdx !== idx
                      ? 'opacity-40 text-[var(--muted-foreground)]'
                      : 'text-[var(--foreground)]'
                  }`}
                >
                  {item}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
            {spec.rows.map((row, rIdx) => (
              <tr key={rIdx}>
                <td className="px-4 py-3 font-medium text-[var(--foreground)] align-top">
                  {row.dimension}
                </td>
                {row.values.map((val, cIdx) => (
                  <td
                    key={cIdx}
                    className={`px-4 py-3 leading-relaxed align-top transition-opacity ${
                      focusedItemIdx !== null && focusedItemIdx !== cIdx
                        ? 'opacity-40 text-[var(--muted-foreground)]'
                        : 'text-[var(--foreground)]'
                    }`}
                  >
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Comparison */}
      <div className="space-y-3 sm:hidden">
        {spec.rows.map((row, rIdx) => (
          <div
            key={rIdx}
            className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5 space-y-2.5"
          >
            <div className="text-[13px] font-semibold text-[var(--foreground)]">
              {row.dimension}
            </div>
            <div className="space-y-2">
              {row.values.map((val, cIdx) => (
                <div
                  key={cIdx}
                  className={`rounded-[9px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] transition-opacity ${
                    focusedItemIdx !== null && focusedItemIdx !== cIdx ? 'opacity-45' : ''
                  }`}
                >
                  <div className="font-mono text-[11px] font-medium text-[var(--muted-foreground)]">
                    {spec.items[cIdx]}
                  </div>
                  <div className="mt-0.5 leading-relaxed text-[var(--foreground)]">{val}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
