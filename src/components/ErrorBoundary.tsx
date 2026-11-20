import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    let friendly = 'An unexpected issue interrupted ponder. Your saved work remains intact.';
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string };
      if (parsed.error && parsed.error.toLowerCase().includes('permission')) {
        friendly = 'Cloud sync permissions could not be verified for this action. Please sign in again or reload.';
      }
    } catch {
      // keep friendly message
    }
    return { hasError: true, message: friendly };
  }

  componentDidCatch(error: unknown) {
    console.error('[ponder ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-6 text-[var(--foreground)]">
          <div className="max-w-md space-y-4 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--destructive)]" aria-hidden="true" />
              <div className="space-y-1">
                <h1 className="font-display text-lg font-semibold">Something needs a quick reset</h1>
                <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {this.state.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-[9px] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Reload ponder</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
