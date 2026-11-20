import type {
  ExplorationDepth,
  ExplorationThread,
  SavedExplorationItem,
} from './schema.ts';

const THEME_KEY = 'ponder_theme';
const DEPTH_KEY = 'ponder_depth_v1';
const GUEST_THREADS_KEY = 'ponder_explorations_v1';
const GUEST_SAVED_KEY = 'ponder_saved_v1';
const GUEST_NOTES_KEY = 'ponder_notes_v1';
const MAX_GUEST_THREADS = 25;

export type ThemePreference = 'light' | 'dark';

export function getSavedTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore storage access errors
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(theme: ThemePreference): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage write errors
  }
}

export function getSavedDepth(): ExplorationDepth {
  try {
    const saved = localStorage.getItem(DEPTH_KEY);
    if (saved === 'quick' || saved === 'standard' || saved === 'deep') return saved;
  } catch {
    // Ignore
  }
  return 'standard';
}

export function saveDepthPreference(depth: ExplorationDepth): void {
  try {
    localStorage.setItem(DEPTH_KEY, depth);
  } catch {
    // Ignore
  }
}

export function loadGuestThreads(): ExplorationThread[] {
  try {
    const raw = localStorage.getItem(GUEST_THREADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is ExplorationThread =>
        t &&
        typeof t.id === 'string' &&
        typeof t.title === 'string' &&
        Array.isArray(t.turns) &&
        t.turns.length > 0
    );
  } catch {
    return [];
  }
}

export function saveGuestThreads(threads: ExplorationThread[]): void {
  try {
    localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(threads.slice(0, MAX_GUEST_THREADS)));
  } catch {
    // Ignore quota errors
  }
}

export function clearGuestThreads(): void {
  try {
    localStorage.removeItem(GUEST_THREADS_KEY);
  } catch {
    // Ignore
  }
}

export function loadGuestSaved(): SavedExplorationItem[] {
  try {
    const raw = localStorage.getItem(GUEST_SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGuestSaved(items: SavedExplorationItem[]): void {
  try {
    localStorage.setItem(GUEST_SAVED_KEY, JSON.stringify(items.slice(0, 60)));
  } catch {
    // Ignore
  }
}

export function loadGuestNotesMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(GUEST_NOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveGuestNotesMap(notes: Record<string, string>): void {
  try {
    localStorage.setItem(GUEST_NOTES_KEY, JSON.stringify(notes));
  } catch {
    // Ignore
  }
}
