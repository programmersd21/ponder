import React, { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { evaluateMathExpression, formatNumber } from '../../lib/mathParser.ts';
import type { VisualisationSpec } from '../../lib/schema.ts';

type ExperimentSpec = Extract<VisualisationSpec, { type: 'experiment_slider' }>;

export function ExperimentSlider({ spec }: { spec: ExperimentSpec }) {
  const initialValues = useMemo(() => {
    const obj: Record<string, number> = {};
    for (const p of spec.parameters) obj[p.id] = p.defaultValue;
    return obj;
  }, [spec.parameters]);

  const [values, setValues] = useState<Record<string, number>>(initialValues);

  const outputs = useMemo(() => {
    return spec.outputs.map((o) => {
      const val = evaluateMathExpression(o.expression, values);
      return { ...o, value: val };
    });
  }, [spec.outputs, values]);

  const activeInsight = useMemo(() => {
    if (!spec.insightRules || spec.insightRules.length === 0) return null;
    for (const rule of spec.insightRules) {
      const target = outputs.find((o) => o.id === rule.outputId);
      if (!target || target.value === null) continue;
      if (rule.below !== undefined && target.value < rule.below) return rule.message;
      if (rule.above !== undefined && target.value > rule.above) return rule.message;
    }
    return null;
  }, [spec.insightRules, outputs]);

  const handleNumericChange = (id: string, min: number, max: number, raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(Math.max(parsed, min), max);
    setValues((prev) => ({ ...prev, [id]: clamped }));
  };

  return (
    <div className="space-y-5">
      {/* Live Output Readouts */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {outputs.map((out) => (
          <div
            key={out.id}
            className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-secondary)] p-4"
          >
            <div className="text-[12px] text-[var(--muted-foreground)]">{out.label}</div>
            <div className="mt-1 font-mono text-2xl font-medium text-[var(--foreground)] tabular-nums">
              {out.value !== null ? formatNumber(out.value, out.precision ?? 2) : ','}
              {out.unit && (
                <span className="ml-1.5 text-sm font-normal text-[var(--muted-foreground)]">
                  {out.unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Explanatory insight */}
      {activeInsight && (
        <p className="rounded-[11px] bg-[var(--accent-subtle)] px-4 py-3 text-[13px] leading-relaxed text-[var(--foreground)]">
          {activeInsight}
        </p>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
        {spec.parameters.map((p) => {
          const val = values[p.id] ?? p.defaultValue;
          return (
            <div key={p.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`exp-slider-${p.id}`} className="text-[13px] font-medium">
                  {p.label}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    aria-label={`${p.label} numeric value`}
                    type="number"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={val}
                    onChange={(e) => handleNumericChange(p.id, p.min, p.max, e.target.value)}
                    className="w-20 rounded-[7px] border border-[var(--input)] bg-[var(--surface)] px-2 py-1 text-right font-mono text-[12px] text-[var(--foreground)] tabular-nums"
                  />
                  {p.unit && (
                    <span className="font-mono text-[12px] text-[var(--muted-foreground)]">
                      {p.unit}
                    </span>
                  )}
                </div>
              </div>
              <input
                id={`exp-slider-${p.id}`}
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={val}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))
                }
                className="ponder-slider"
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setValues(initialValues)}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Reset parameters</span>
        </button>
      </div>
    </div>
  );
}
