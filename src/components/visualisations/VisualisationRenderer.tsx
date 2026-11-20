import React from 'react';
import type { VisualisationSpec } from '../../lib/schema.ts';
import { CalculatorView } from './CalculatorView.tsx';
import { ComparisonView } from './ComparisonView.tsx';
import { ConceptSimulation } from './ConceptSimulation.tsx';
import { DiagramView } from './DiagramView.tsx';
import { ExperimentSlider } from './ExperimentSlider.tsx';
import { InteractiveGraph } from './InteractiveGraph.tsx';
import { StepExplorer } from './StepExplorer.tsx';
import { TimelineView } from './TimelineView.tsx';

const TYPE_LABELS: Record<VisualisationSpec['type'], string> = {
  concept_simulation: 'Interactive model',
  interactive_graph: 'Interactive graph',
  experiment_slider: 'Experiment',
  step_explorer: 'Step-by-step trace',
  timeline: 'Timeline',
  comparison: 'Comparison',
  labelled_diagram: 'Interactive diagram',
  calculator: 'Calculator',
};

type ErrorBoundaryState = { hasError: boolean };

class VisualisationErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    // Handled gracefully by fallback UI
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-secondary)] p-5 text-[14px] text-[var(--muted-foreground)]">
          This interactive model could not be displayed cleanly, though the written explanation above remains accurate.
        </div>
      );
    }
    return this.props.children;
  }
}

export function VisualisationRenderer({ spec }: { spec: VisualisationSpec }) {
  const renderBody = () => {
    switch (spec.type) {
      case 'concept_simulation':
        return <ConceptSimulation spec={spec} />;
      case 'interactive_graph':
        return <InteractiveGraph spec={spec} />;
      case 'experiment_slider':
        return <ExperimentSlider spec={spec} />;
      case 'step_explorer':
        return <StepExplorer spec={spec} />;
      case 'timeline':
        return <TimelineView spec={spec} />;
      case 'comparison':
        return <ComparisonView spec={spec} />;
      case 'labelled_diagram':
        return <DiagramView spec={spec} />;
      case 'calculator':
        return <CalculatorView spec={spec} />;
    }
  };

  return (
    <section
      aria-label={spec.title}
      className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"
    >
      <div className="mb-4 flex flex-col gap-1 border-b border-[var(--border)] pb-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
            {spec.title}
          </h3>
          <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
            {TYPE_LABELS[spec.type]}
          </span>
        </div>
        {spec.description && (
          <p className="text-[13px] leading-relaxed text-[var(--muted-foreground)]">
            {spec.description}
          </p>
        )}
      </div>

      <VisualisationErrorBoundary>{renderBody()}</VisualisationErrorBoundary>
    </section>
  );
}
