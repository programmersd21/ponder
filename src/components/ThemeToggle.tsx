import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '../lib/storage.ts';

type ThemeToggleProps = {
  theme: ThemePreference;
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="inline-flex h-10 w-10 items-center justify-center rounded-[9px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-secondary)] active:scale-[0.97] shrink-0 cursor-pointer"
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
