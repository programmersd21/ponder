import React from 'react';
import type { User } from 'firebase/auth';
import { Keyboard, PanelLeft, Plus, Settings } from 'lucide-react';
import type { SoundPreferences } from '../lib/soundEngine.ts';
import { soundEngine } from '../lib/soundEngine.ts';
import type { ThemePreference } from '../lib/storage.ts';
import { PonderLogo } from './PonderLogo.tsx';
import { SoundPreferencesPopover } from './SoundPreferencesPopover.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

export type AppView = 'landing' | 'workspace' | 'share';

type AppHeaderProps = {
  view: AppView;
  theme: ThemePreference;
  onToggleTheme: () => void;
  soundPrefs: SoundPreferences;
  onSoundPrefsChange: (next: SoundPreferences) => void;
  onNavigateView: (view: AppView) => void;
  onNewExploration?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  onOpenShortcuts?: () => void;
  onOpenSettings?: () => void;
  user?: User | null;
  onSignIn?: () => Promise<void>;
  hasActiveExploration?: boolean;
};

export function AppHeader({
  view,
  theme,
  onToggleTheme,
  soundPrefs,
  onSoundPrefsChange,
  onNavigateView,
  onNewExploration,
  onToggleSidebar,
  sidebarOpen = false,
  onOpenShortcuts,
  onOpenSettings,
  user,
  onSignIn,
  hasActiveExploration = false,
}: AppHeaderProps) {
  if (view === 'landing') {
    return (
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/92 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1160px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 text-[var(--foreground)] whitespace-nowrap shrink-0"
          >
            <PonderLogo size={22} />
            <span className="font-display text-lg font-semibold tracking-tight">ponder</span>
          </a>

          <nav
            aria-label="primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[var(--muted-foreground)]"
          >
            <a
              href="#ask"
              className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[var(--foreground)] hover:underline underline-offset-4"
            >
              ask
            </a>
            <a
              href="#engine"
              className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[var(--foreground)] hover:underline underline-offset-4"
            >
              visualisations
            </a>
            <a
              href="#principles"
              className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[var(--foreground)] hover:underline underline-offset-4"
            >
              how it works
            </a>
            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui.press', true);
                onNavigateView('workspace');
              }}
              className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[var(--foreground)] hover:underline underline-offset-4 cursor-pointer"
            >
              workspace
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
  <SoundPreferencesPopover prefs={soundPrefs} onChange={onSoundPrefsChange} />
            <ThemeToggle theme={theme} onToggle={() => {
              soundEngine.play('ui.toggle', true);
              onToggleTheme();
            }} />
            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui.press', true);
                onNavigateView('workspace');
              }}
              className="inline-flex h-10 items-center justify-center rounded-[9px] bg-[var(--primary)] px-3 sm:px-4 text-sm font-medium text-[var(--primary-foreground)] transition-all duration-150 hover:opacity-90 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="hidden min-[380px]:inline">start exploring</span>
              <span className="min-[380px]:hidden">explore</span>
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/94 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex items-center gap-2.5 min-w-0">
          {view === 'workspace' && onToggleSidebar && (
            <button
              type="button"
              onClick={() => {
                soundEngine.play(sidebarOpen ? 'ui.close' : 'ui.open', true);
                onToggleSidebar();
              }}
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? 'Collapse exploration history sidebar' : 'Open exploration history sidebar'}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-[9px] border transition-colors cursor-pointer shrink-0 ${
                sidebarOpen
                  ? 'border-[var(--accent)]/60 bg-[var(--accent-subtle)] text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
              }`}
            >
              <PanelLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              soundEngine.play('ui.press', true);
              if (view === 'share') {
                onNavigateView('workspace');
              } else {
                onNewExploration?.();
              }
            }}
            className="inline-flex items-center gap-2 text-[var(--foreground)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PonderLogo size={22} />
            <span className="font-display text-lg font-semibold tracking-tight">ponder</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('ui.press', true);
              onNavigateView('landing');
            }}
            className="hidden sm:inline-flex ml-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors duration-150 hover:text-[var(--foreground)] hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
          >
            overview
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenShortcuts && view === 'workspace' && (
            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui.open', true);
                onOpenShortcuts();
              }}
              aria-label="keyboard shortcuts"
              title="keyboard shortcuts (?)"
              className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-[9px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] cursor-pointer shrink-0"
            >
              <Keyboard className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui.open', true);
                onOpenSettings();
              }}
              aria-label="gemini settings"
              title="gemini settings"
              className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-[9px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] cursor-pointer shrink-0"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <SoundPreferencesPopover prefs={soundPrefs} onChange={onSoundPrefsChange} />
          <ThemeToggle theme={theme} onToggle={() => {
            soundEngine.play('ui.toggle', true);
            onToggleTheme();
          }} />

          {view === 'workspace' && !user && onSignIn && (
            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui.press', true);
                void onSignIn();
              }}
              className="hidden md:inline-flex h-10 items-center rounded-[9px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              sign in
            </button>
          )}

          {hasActiveExploration && onNewExploration && (
            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui.press', true);
                onNewExploration();
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-[9px] bg-[var(--primary)] px-3.5 text-sm font-medium text-[var(--primary-foreground)] transition-all duration-150 hover:opacity-90 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">new topic</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
