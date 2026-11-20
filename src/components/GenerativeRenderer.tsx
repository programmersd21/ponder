import React from 'react';
import { SpecRenderer, useSpecStream } from 'generative-frame/spec/react';
import { ponderCatalog } from '../lib/generativeCatalog.ts';
import { MathText } from './MathText.tsx';

const components = {
  Card: ({ props, children }: { props: { title: string; subtitle?: string }; children?: React.ReactNode }) => (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
      <div className="font-display text-lg font-semibold text-[var(--foreground)]">{props.title}</div>
      {props.subtitle && <div className="text-[13px] text-[var(--muted-foreground)]">{props.subtitle}</div>}
      <div className="space-y-2">{children}</div>
    </div>
  ),
  Button: ({ props, emit }: { props: { label: string; variant?: string }; emit: (e: string) => void }) => (
    <button
      type="button"
      onClick={() => emit('press')}
      className="inline-flex min-h-[36px] items-center rounded-[8px] bg-[var(--primary)] px-3 text-[13px] font-medium text-[var(--primary-foreground)] hover:opacity-90 cursor-pointer"
    >
      {props.label}
    </button>
  ),
  Text: ({ props }: { props: { content: string } }) => (
    <p className="text-[15px] leading-relaxed text-[var(--foreground)]">
      <MathText text={props.content} />
    </p>
  ),
  Quiz: ({ props }: { props: { question: string; options: string[]; correctIndex: number; explanation?: string } }) => {
    const [chosen, setChosen] = React.useState<number | null>(null);
    const correct = chosen !== null && chosen === props.correctIndex;
    return (
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-secondary)] p-4 space-y-3">
        <p className="text-[14.5px] font-medium text-[var(--foreground)]">{props.question}</p>
        <div className="space-y-1.5">
          {props.options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setChosen(idx)}
              className={`flex w-full items-center justify-between rounded-[9px] border px-3.5 py-2.5 text-left text-[13.5px] transition-colors cursor-pointer ${
                chosen === null
                  ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--border-strong)]'
                  : idx === props.correctIndex
                    ? 'border-[var(--success)] bg-[var(--accent-subtle)] text-[var(--foreground)]'
                    : chosen === idx
                      ? 'border-[var(--warning)] bg-[var(--surface-tertiary)] text-[var(--foreground)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] opacity-75'
              }`}
            >
              <span>{opt}</span>
              {chosen !== null && idx === props.correctIndex && (
                <span className="font-mono text-[11px] font-medium text-[var(--success)]">correct</span>
              )}
            </button>
          ))}
        </div>
        {chosen !== null && props.explanation && (
          <p className="text-[13px] leading-relaxed text-[var(--muted-foreground)]">
            <span className="font-medium text-[var(--foreground)]">{correct ? 'right — ' : 'not quite — '}</span>
            {props.explanation}
          </p>
        )}
      </div>
    );
  },
  Flashcard: ({ props }: { props: { front: string; back: string } }) => {
    const [flipped, setFlipped] = React.useState(false);
    return (
      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        className="w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 text-left min-h-[120px] cursor-pointer"
      >
        <div className="text-[13px] text-[var(--muted-foreground)]">{flipped ? 'answer' : 'question'}</div>
        <div className="mt-2 font-display text-lg text-[var(--foreground)]">{flipped ? props.back : props.front}</div>
      </button>
    );
  },
  Progress: ({ props }: { props: { value: number; label?: string } }) => (
    <div className="space-y-1.5">
      {props.label && <div className="text-[12.5px] text-[var(--muted-foreground)]">{props.label}</div>}
      <div className="h-2 w-full rounded-full bg-[var(--surface-tertiary)] overflow-hidden">
        <div className="h-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, props.value))}%` }} />
      </div>
    </div>
  ),
  CodeBlock: ({ props }: { props: { code: string; language?: string } }) => (
    <pre className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-secondary)] p-4 overflow-x-auto font-mono text-[12.5px] text-[var(--foreground)]">
      <code>{props.code}</code>
    </pre>
  ),
  Slider: ({ props }: { props: { label: string; min: number; max: number; step?: number; statePath: string } }) => {
    const [val, setVal] = React.useState(props.min);
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between text-[13px]">
          <label className="font-medium">{props.label}</label>
          <span className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">{val}</span>
        </div>
        <input
          type="range"
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          className="ponder-slider"
        />
      </div>
    );
  },
};

export function GenerativeRenderer({ source, streaming }: { source: string; streaming?: boolean }) {
  const { spec, errors } = useSpecStream({ source, mode: 'inline', complete: !streaming });
  return (
    <div className="space-y-3">
      <SpecRenderer spec={spec} components={components} catalog={ponderCatalog} streaming={streaming} />
      {errors && errors.length > 0 && (
        <div className="rounded-[10px] border border-[var(--destructive)]/40 bg-[var(--surface)] p-3 text-[12.5px] text-[var(--destructive)]">
          {errors.map((e: unknown, i: number) => <div key={i}>{String(e)}</div>)}
        </div>
      )}
    </div>
  );
}
