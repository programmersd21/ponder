import React from 'react';
import { PonderLogo } from './PonderLogo.tsx';
import type { AppView } from './AppHeader.tsx';

type AppFooterProps = {
  onNavigateView: (view: AppView) => void;
  onOpenMoonDemo?: () => void;
};

export function AppFooter({ onNavigateView, onOpenMoonDemo }: AppFooterProps) {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1.5">
          <div className="inline-flex items-center gap-2 text-[var(--foreground)]">
            <PonderLogo size={18} />
            <span className="font-display text-base font-semibold tracking-tight">ponder</span>
          </div>
          <p className="text-[13px] text-[var(--muted-foreground)]">
            a little more wonder. a lot more understanding.
          </p>
        </div>

        <nav
          aria-label="footer navigation"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] font-medium text-[var(--muted-foreground)]"
        >
          <button
            type="button"
            onClick={() => onNavigateView('workspace')}
            className="hover:text-[var(--foreground)] hover:underline underline-offset-4 transition-colors cursor-pointer"
          >
            open workspace
          </button>
          {onOpenMoonDemo && (
            <button
              type="button"
              onClick={onOpenMoonDemo}
              className="hover:text-[var(--foreground)] hover:underline underline-offset-4 transition-colors cursor-pointer"
            >
              moon phase explorer
            </button>
          )}
          <a
            href="#engine"
            className="hover:text-[var(--foreground)] hover:underline underline-offset-4 transition-colors"
          >
            visualisation engine
          </a>
          <a
            href="#principles"
            className="hover:text-[var(--foreground)] hover:underline underline-offset-4 transition-colors"
          >
            how it works
          </a>
        </nav>
      </div>
    </footer>
  );
}
