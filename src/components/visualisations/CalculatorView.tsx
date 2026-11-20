import React, { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { evaluateMathExpression, formatNumber } from '../../lib/mathParser.ts';
import type { VisualisationSpec } from '../../lib/schema.ts';

type CalculatorSpec = Extract<VisualisationSpec, { type: 'calculator' }>;

export function CalculatorView({ spec }: { spec: CalculatorSpec }) {
  const initialValues = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inp of spec.inputs) map[inp.id] = inp.defaultValue;
    return map;
  }, [spec.inputs]);

  const [values, setValues] = useState<Record<string, number>>(initialValues);

  const results = useMemo(() => {
    return spec.outputs.map((o) => {
      const val = evaluateMathExpression(o.expression, values);
      return { ...o, value: val };
    });
  }, [spec.outputs, values]);

  const handleNumberInput = (id: string, min: number, max: number, raw: string) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    setValues((prev) => ({
      ...prev,
      [id]: Math.min(Math.max(num, min), max),
    }));
  };

  return (
    <div className="space-y-5">
      {/* Formula display */}
      <div className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 font-mono text-[13px] text-[var(--foreground)]">
        {spec.formulaDisplay}
      </div>

      {/* Presets */}
      {spec.presets && spec.presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-[var(--muted-foreground)]">Presets:</span>
          {spec.presets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() =>
                setValues((prev) => {
                  const next = { ...prev };
                  for (const inp of spec.inputs) {
                    if (typeof preset.values[inp.id] === 'number') {
                      next[inp.id] = Math.min(Math.max(preset.values[inp.id], inp.min), inp.max);
                    }
                  }
                  return next;
                })
              }
              className="min-h-[34px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {spec.inputs.map((inp) => {
          const val = values[inp.id] ?? inp.defaultValue;
          return (
            <div
              key={inp.id}
              className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`calc-input-${inp.id}`} className="text-[13px] font-medium">
                  {inp.label}
                </label>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  {inp.min}-{inp.max} {inp.unit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={`calc-input-${inp.id}`}
                  type="number"
                  min={inp.min}
                  max={inp.max}
                  step={inp.step}
                  value={val}
                  onChange={(e) => handleNumberInput(inp.id, inp.min, inp.max, e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--input)] bg-[var(--surface-secondary)] px-3 py-2 font-mono text-sm text-[var(--foreground)] tabular-nums"
                />
                {inp.unit && (
                  <span className="font-mono text-[12px] text-[var(--muted-foreground)] shrink-0">
                    {inp.unit}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {results.map((res) => (
          <div
            key={res.id}
            className="rounded-[12px] border border-[var(--border)] bg-[var(--accent-subtle)] p-4"
          >
            <div className="text-[12px] text-[var(--muted-foreground)]">{res.label}</div>
            <div className="mt-1 font-mono text-2xl font-medium text-[var(--foreground)] tabular-nums">
              {res.value !== null ? formatNumber(res.value, res.precision ?? 3) : ','}
              {res.unit && (
                <span className="ml-1.5 text-sm font-normal text-[var(--muted-foreground)]">
                  {res.unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setValues(initialValues)}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
}
