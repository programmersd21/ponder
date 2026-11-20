import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  ENGINE_SHOWCASE_DEMOS,
  EXAMPLE_QUESTIONS,
} from '../lib/showcaseData.ts';
import type { AppView } from './AppHeader.tsx';
import { AppFooter } from './AppFooter.tsx';
import { ConceptSimulation } from './visualisations/ConceptSimulation.tsx';
import { VisualisationRenderer } from './visualisations/VisualisationRenderer.tsx';
import { TypingText } from '@animate-ui/react/primitives/texts/typing';

type LandingPageProps = {
  onStartExploring: (initialQuestion?: string) => void;
  onOpenMoonDemo: () => void;
  onNavigateView: (view: AppView) => void;
};

export function LandingPage({
  onStartExploring,
  onOpenMoonDemo,
  onNavigateView,
}: LandingPageProps) {
  const [activeDemoId, setActiveDemoId] = useState<string>(ENGINE_SHOWCASE_DEMOS[1].id);
  const activeDemo =
    ENGINE_SHOWCASE_DEMOS.find((d) => d.id === activeDemoId) ?? ENGINE_SHOWCASE_DEMOS[0];

  const heroDemo = {
    id: 'hero-wave',
    label: 'Wave interference',
    question: 'How do sound waves work?',
    caption: 'Adjust frequency, amplitude, and phase to see how waves combine.',
    spec: {
      type: 'concept_simulation' as const,
      mode: 'wave_interference' as const,
      title: 'Sound wave explorer',
      description: 'Explore frequency, amplitude, and phase.',
      defaultAngle: 0,
    },
  };

  return (
    <main id="top" className="bg-[var(--background)] text-[var(--foreground)]">
      {/* 1. Hero & Live Product Demonstration */}
      <section className="mx-auto flex min-h-[calc(100dvh-56px)] max-w-[1160px] flex-col justify-center px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
          {/* Editorial Proposition */}
          <div className="lg:col-span-5 space-y-5">
            <h1 className="font-display text-[clamp(2.25rem,4vw,3.25rem)] font-semibold tracking-tight leading-[1.08] text-[var(--foreground)]">
              <TypingText text="understand anything, a little deeper." duration={80} />
            </h1>

            <p className="max-w-[42ch] text-[17px] leading-relaxed text-[var(--muted-foreground)]">
              ask a question. explore an explanation. see how it works.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onStartExploring()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[9px] bg-[var(--primary)] px-5 py-2.5 text-[15px] font-medium text-[var(--primary-foreground)] transition-all duration-150 hover:opacity-90 active:scale-[0.98] cursor-pointer"
              >
                <span>start exploring</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <a
                href="#engine"
                className="inline-flex min-h-[44px] items-center rounded-[9px] border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[15px] font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-secondary)]"
              >
                see how it works
              </a>
            </div>
          </div>

          {/* Live Product Demonstration */}
          <div className="lg:col-span-7">
            <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div>
                  <div className="font-mono text-[11px] text-[var(--muted-foreground)]">
                    Live exploration
                  </div>
                  <h2 className="mt-0.5 font-display text-lg font-semibold text-[var(--foreground)]">
                    {heroDemo.question}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenMoonDemo}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--accent)] hover:underline underline-offset-4 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>open full explanation</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <p className="mb-4 text-[13.5px] leading-relaxed text-[var(--muted-foreground)]">
                {heroDemo.caption}
              </p>

              <VisualisationRenderer key={heroDemo.id} spec={heroDemo.spec} />
            </div>
          </div>
        </div>
      </section>

      {/* 2. ask a Question */}
      <section
        id="ask"
        className="border-t border-[var(--border)] bg-[var(--surface)]"
      >
        <div className="mx-auto max-w-[1160px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5 space-y-4">
              <h2 className="font-display text-[clamp(1.65rem,3vw,2.25rem)] font-semibold tracking-tight leading-tight">
                start with a genuine question.
              </h2>
              <p className="max-w-[44ch] text-[15px] leading-relaxed text-[var(--muted-foreground)]">
                No account required, and no generic wall of text. ask about physics, mathematics, algorithms, or everyday phenomena, ponder pairs a clear answer with a model you can test yourself.
              </p>
            </div>

            <div className="lg:col-span-7 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {EXAMPLE_QUESTIONS.slice(0, 5).map((item) => (
                <button
                  key={item.question}
                  type="button"
                  onClick={() => onStartExploring(item.question)}
                  className="group flex w-full items-center justify-between gap-4 py-4 px-2 text-left transition-colors duration-150 hover:bg-[var(--surface-secondary)] cursor-pointer"
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
      </section>

      {/* 3. Interactive Visualisation Engine */}
      <section id="engine" className="border-t border-[var(--border)] bg-[var(--background)]">
        <div className="mx-auto max-w-[1160px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-8">
            <div className="max-w-[600px] space-y-3">
              <h2 className="font-display text-[clamp(1.65rem,3vw,2.25rem)] font-semibold tracking-tight leading-tight">
                change a parameter. watch what happens.
              </h2>
              <p className="text-[15px] leading-relaxed text-[var(--muted-foreground)]">
                Every visualisation runs on validated mathematical models and trusted interactive components, never fabricated charts or static pictures pretending to move.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="visualisation engine demonstrations"
              className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[11px] border border-[var(--border)] bg-[var(--surface)] p-1 shrink-0"
            >
              {ENGINE_SHOWCASE_DEMOS.map((demo) => {
                const active = demo.id === activeDemo.id;
                return (
                  <button
                    key={demo.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveDemoId(demo.id)}
                    className={`min-h-[36px] rounded-[8px] px-3 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {demo.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] text-[var(--muted-foreground)]">
                <span className="font-medium text-[var(--foreground)]">{activeDemo.question}</span>
                <span aria-hidden="true"> , </span>
                <span>{activeDemo.caption}</span>
              </p>
              <button
                type="button"
                onClick={() =>
                  activeDemo.id === 'moon'
                    ? onOpenMoonDemo()
                    : onStartExploring(activeDemo.question)
                }
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--accent)] hover:underline underline-offset-4 cursor-pointer shrink-0"
              >
                <span>explore this question</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <VisualisationRenderer key={activeDemo.id} spec={activeDemo.spec} />
          </div>
        </div>
      </section>

      {/* 4. Principles */}
      <section
        id="principles"
        className="border-t border-[var(--border)] bg-[var(--surface)]"
      >
        <div className="mx-auto max-w-[1160px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-[620px] mb-10 space-y-2">
            <h2 className="font-display text-[clamp(1.65rem,3vw,2.25rem)] font-semibold tracking-tight leading-tight">
              built for understanding, not noise.
            </h2>
            <p className="text-[15px] text-[var(--muted-foreground)]">
              Three quiet commitments behind every response in ponder.
            </p>
          </div>

          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            <div className="grid grid-cols-1 gap-3 py-6 md:grid-cols-12 md:gap-8">
              <div className="md:col-span-4 font-display text-[17px] font-semibold text-[var(--foreground)]">
                01. Direct answers first
              </div>
              <p className="md:col-span-8 max-w-[62ch] text-[15px] leading-relaxed text-[var(--muted-foreground)]">
                Every topic opens with a plain-English summary before stepping into deeper mechanics, so you grasp the core idea in seconds rather than wading through filler.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 py-6 md:grid-cols-12 md:gap-8">
              <div className="md:col-span-4 font-display text-[17px] font-semibold text-[var(--foreground)]">
                02. Real computation, never guesswork
              </div>
              <p className="md:col-span-8 max-w-[62ch] text-[15px] leading-relaxed text-[var(--muted-foreground)]">
                Graphs, calculators, and orbital diagrams validate their bounds and compute live results directly in the browser. When a question is best answered with words alone, ponder skips the widget.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 py-6 md:grid-cols-12 md:gap-8">
              <div className="md:col-span-4 font-display text-[17px] font-semibold text-[var(--foreground)]">
                03. Follow-ups that keep context
              </div>
              <p className="md:col-span-8 max-w-[62ch] text-[15px] leading-relaxed text-[var(--muted-foreground)]">
                ask why an equation behaves a certain way or request a simpler analogy without losing the thread you are already exploring.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Final Invitation */}
      <section className="border-t border-[var(--border)] bg-[var(--background)]">
        <div className="mx-auto flex max-w-[1160px] flex-col items-start justify-between gap-6 px-4 py-16 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              ready to test an idea?
            </h2>
            <p className="text-[15px] text-[var(--muted-foreground)]">
              Open the workspace and ask whatever you are curious about today.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onStartExploring()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[9px] bg-[var(--primary)] px-5 py-2.5 text-[15px] font-medium text-[var(--primary-foreground)] transition-all duration-150 hover:opacity-90 active:scale-[0.98] cursor-pointer shrink-0"
          >
            <span>open ponder workspace</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <AppFooter onNavigateView={onNavigateView} onOpenMoonDemo={onOpenMoonDemo} />
    </main>
  );
}
