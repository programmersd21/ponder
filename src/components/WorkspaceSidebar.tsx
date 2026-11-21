import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { User } from 'firebase/auth';
import {
  Bookmark,
  Check,
  FileDown,
  LogIn,
  LogOut,
  Pencil,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { ExplorationThread, SavedExplorationItem } from '../lib/schema.ts';
import { soundEngine } from '../lib/soundEngine.ts';

type WorkspaceSidebarProps = {
  open: boolean;
  onCloseMobile: () => void;
  threads: ExplorationThread[];
  savedItems: SavedExplorationItem[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewExploration: () => void;
  onRenameThread: (threadId: string, nextTitle: string) => Promise<void>;
  onTogglePin: (threadId: string, nextPinned: boolean) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
  onExportPdf: (threadId: string) => void;
  onRemoveSaved: (savedId: string) => Promise<void>;
  user: User | null;
  authReady: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onDeleteAllData: () => Promise<void>;
  authError?: string | null;
  migrationNote?: string | null;
};

type GroupKey = 'Pinned' | 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older';

function classifyGroup(thread: ExplorationThread, nowMs: number): GroupKey {
  if (thread.pinned) return 'Pinned';
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const yesterdayMs = todayMs - 86_400_000;
  const sevenDaysMs = todayMs - 7 * 86_400_000;

  if (thread.updatedAt >= todayMs) return 'Today';
  if (thread.updatedAt >= yesterdayMs) return 'Yesterday';
  if (thread.updatedAt >= sevenDaysMs) return 'Previous 7 days';
  return 'Older';
}

export function WorkspaceSidebar({
  open,
  onCloseMobile,
  threads,
  savedItems,
  activeThreadId,
  onSelectThread,
  onNewExploration,
  onRenameThread,
  onTogglePin,
  onDeleteThread,
  onExportPdf,
  onRemoveSaved,
  user,
  authReady,
  onSignIn,
  onSignOut,
  onDeleteAllData,
  authError,
  migrationNote,
}: WorkspaceSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'saved'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [cconfirmDeleteId, setCconfirmDeleteId] = useState<string | null>(null);
  const [confirmAccountdelete, setConfirmAccountdelete] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const groupedThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? threads.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.turns.some((turn) => turn.question.toLowerCase().includes(q))
        )
      : threads;

    const sorted = [...filtered].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

    const nowMs = Date.now();
    const buckets: Record<GroupKey, ExplorationThread[]> = {
      Pinned: [],
      Today: [],
      Yesterday: [],
      'Previous 7 days': [],
      Older: [],
    };
    for (const thread of sorted) {
      buckets[classifyGroup(thread, nowMs)].push(thread);
    }
    return buckets;
  }, [threads, searchQuery]);

  const filteredsaved = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return savedItems;
    return savedItems.filter(
      (s) => s.title.toLowerCase().includes(q) || s.question.toLowerCase().includes(q)
    );
  }, [savedItems, searchQuery]);

  const startEditing = (thread: ExplorationThread) => {
    setEditingId(thread.id);
    setEditTitle(thread.title);
  };

  const commitEdit = async (threadId: string) => {
    const trimmed = editTitle.trim();
    setEditingId(null);
    if (trimmed) {
      await onRenameThread(threadId, trimmed);
      soundEngine.play('feedback.success', true);
    }
  };

  const sidebarBody = (
    <div className="flex h-full flex-col bg-[var(--surface)] text-[var(--foreground)]">
      {/* Top Action & Search */}
      <div className="space-y-3 border-b border-[var(--border)] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('ui.press', true);
              onNewExploration();
              onCloseMobile();
            }}
            className="flex min-h-[38px] flex-1 items-center justify-center gap-2 rounded-[9px] bg-[var(--primary)] px-3 text-[13px] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>new exploration</span>
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="close sidebar"
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[9px] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] lg:hidden cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--subtle-foreground)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="search explorations…"
            aria-label="search conversation history"
            className="h-9 w-full rounded-[8px] border border-[var(--border)] bg-[var(--background)] pl-8 pr-3 text-[13px] text-[var(--foreground)] placeholder:text-[var(--subtle-foreground)] focus:border-[var(--ring)] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-[9px] border border-[var(--border)] bg-[var(--surface-secondary)] p-0.5">
          <button
            type="button"
            onClick={() => {
              setTab('all');
              soundEngine.play('ui.toggle', true);
            }}
            className={`relative min-h-[30px] rounded-[7px] text-[12px] font-medium transition-colors cursor-pointer ${
              tab === 'all'
                ? 'text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab === 'all' && (
              <motion.span
                layoutId="sidebar-tab-indicator"
                className="absolute inset-0 rounded-[7px] bg-[var(--surface-elevated)] shadow-sm"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">history ({threads.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('saved');
              soundEngine.play('ui.toggle', true);
            }}
            className={`relative min-h-[30px] rounded-[7px] text-[12px] font-medium transition-colors cursor-pointer ${
              tab === 'saved'
                ? 'text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab === 'saved' && (
              <motion.span
                layoutId="sidebar-tab-indicator"
                className="absolute inset-0 rounded-[7px] bg-[var(--surface-elevated)] shadow-sm"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">saved ({savedItems.length})</span>
          </button>
        </div>
      </div>

      {/* Scrollable history / Bookmarks List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        {tab === 'all' ? (
          threads.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-[13.5px] font-medium text-[var(--foreground)]">
                no explorations yet
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
                Questions you explore appear here organized by date.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(Object.keys(groupedThreads) as GroupKey[]).map((groupName) => {
                const items = groupedThreads[groupName];
                if (items.length === 0) return null;
                return (
                  <div key={groupName} className="space-y-1">
                    <div className="px-2 pb-1 text-[11px] font-medium text-[var(--subtle-foreground)]">
                      {groupName}
                    </div>
                    <ul className="space-y-0.5">
                      {items.map((thread) => {
                        const isActive = thread.id === activeThreadId;
                        const isEditing = editingId === thread.id;
                        const isConfirmingDel = cconfirmDeleteId === thread.id;

                        return (
                          <li
                            key={thread.id}
                            className={`group rounded-[9px] transition-colors ${
                              isActive
                                ? 'bg-[var(--accent-subtle)]'
                                : 'hover:bg-[var(--surface-secondary)]'
                            }`}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-1 p-1.5">
                                <input
                                  type="text"
                                  value={editTitle}
                                  autoFocus
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') void commitEdit(thread.id);
                                    if (e.key === 'Escape') setEditingId(null);
                                  }}
                                  aria-label="rename conversation"
                                  className="h-8 min-w-0 flex-1 rounded-[6px] border border-[var(--ring)] bg-[var(--surface)] px-2 text-[13px] text-[var(--foreground)] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => void commitEdit(thread.id)}
                                  aria-label="save title"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] bg-[var(--accent)] text-[var(--accent-foreground)] cursor-pointer"
                                >
                                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            ) : isConfirmingDel ? (
                              <div className="flex items-center justify-between gap-2 px-2.5 py-2 text-[12px]">
                                <span className="truncate font-medium text-[var(--destructive)]">
                                  delete thread?
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCconfirmDeleteId(null);
                                      void onDeleteThread(thread.id);
                                      soundEngine.play('ui.press', true);
                                    }}
                                    className="rounded-[6px] bg-[var(--destructive)] px-2 py-1 text-[11px] font-medium text-white cursor-pointer"
                                  >
                                    delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCconfirmDeleteId(null)}
                                    className="rounded-[6px] border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 px-1.5 py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    soundEngine.play('ui.press', true);
                                    onSelectThread(thread.id);
                                    onCloseMobile();
                                  }}
                                  className="min-w-0 flex-1 rounded-[7px] px-1.5 py-1.5 text-left cursor-pointer"
                                >
                                  <div className="truncate text-[13px] font-medium text-[var(--foreground)]">
                                    {thread.title}
                                  </div>
                                </button>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void onTogglePin(thread.id, !thread.pinned);
                                      soundEngine.play('ui.toggle', true);
                                    }}
                                    aria-label={thread.pinned ? `Unpin ${thread.title}` : `Pin ${thread.title}`}
                                    title={thread.pinned ? 'Unpin' : 'Pin'}
                                    className={`inline-flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors cursor-pointer ${
                                      thread.pinned
                                        ? 'text-[var(--accent)]'
                                        : 'text-[var(--subtle-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-tertiary)]'
                                    }`}
                                  >
                                    <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startEditing(thread)}
                                    aria-label={`rename ${thread.title}`}
                                    title="rename"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--subtle-foreground)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--foreground)] cursor-pointer"
                                  >
                                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onExportPdf(thread.id);
                                      soundEngine.play('feedback.success', true);
                                    }}
                                    aria-label={`Export ${thread.title} as pdf`}
                                    title="export pdf"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--subtle-foreground)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--foreground)] cursor-pointer"
                                  >
                                    <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCconfirmDeleteId(thread.id)}
                                    aria-label={`delete ${thread.title}`}
                                    title="delete"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--subtle-foreground)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--destructive)] cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )
        ) : filteredsaved.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-[13.5px] font-medium text-[var(--foreground)]">
              no saved bookmarks
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
              Use save on any explanation to bookmark it here.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {filteredsaved.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-1 rounded-[9px] px-2 py-1.5 hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('ui.press', true);
                    onSelectThread(item.conversationId);
                    onCloseMobile();
                  }}
                  className="min-w-0 flex-1 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--foreground)]">
                    <Bookmark className="h-3.5 w-3.5 shrink-0 text-[var(--accent)] fill-current" aria-hidden="true" />
                    <span className="truncate">{item.title}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-[var(--muted-foreground)]">
                    {item.question}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void onRemoveSaved(item.id);
                    soundEngine.play('ui.press', true);
                  }}
                  aria-label={`Remove ${item.title} from saved`}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-[var(--subtle-foreground)] hover:text-[var(--destructive)] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bottom Persistence & Google Account Section */}
      <div className="border-t border-[var(--border)] p-3.5 space-y-2.5 bg-[var(--surface-secondary)]/55">
        {!authReady ? (
          <div className="text-[12px] text-[var(--muted-foreground)]">Checking account status…</div>
        ) : user ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? 'User'}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full border border-[var(--border)] object-cover shrink-0"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-subtle)] font-mono text-xs font-semibold text-[var(--accent)] shrink-0">
                  {(user.displayName?.[0] ?? user.email?.[0] ?? 'P').toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[var(--foreground)]">
                  {user.displayName ?? 'Google Learner'}
                </div>
                <div className="truncate text-[11px] text-[var(--muted-foreground)]">
                  Cloud history synced
                </div>
              </div>
            </div>

            {!confirmAccountdelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="inline-flex min-h-[32px] flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>sign out</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAccountdelete(true)}
                  title="delete all synced cloud conversations and notes"
                  className="inline-flex min-h-[32px] items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[12px] text-[var(--muted-foreground)] hover:border-[var(--destructive)] hover:text-[var(--destructive)] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="space-y-2 rounded-[9px] border border-[var(--destructive)]/50 bg-[var(--surface)] p-2.5 text-[11.5px]">
                <p className="text-[var(--foreground)]">
                  Permanently delete all cloud threads, saved items, notes, and shares?
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      setConfirmAccountdelete(false);
                      await onDeleteAllData();
                    }}
                    className="flex-1 rounded-[6px] bg-[var(--destructive)] py-1.5 font-medium text-white cursor-pointer"
                  >
                    Confirm delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAccountdelete(false)}
                    className="flex-1 rounded-[6px] border border-[var(--border)] py-1.5 font-medium text-[var(--foreground)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11.5px] leading-snug text-[var(--muted-foreground)]">
              Guest mode · saved locally in this browser only. sign in for persistent cloud history.
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui.press', true);
                void onSignIn();
              }}
              className="flex min-h-[36px] w-full items-center justify-center gap-2 rounded-[9px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-[12.5px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] transition-colors cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
              <span>sign in with Google</span>
            </button>
          </div>
        )}

        {migrationNote && (
          <div role="status" className="rounded-[9px] border border-[var(--success)]/40 bg-[var(--success-soft)] px-3 py-2 text-[11.5px] leading-snug text-[var(--success)]">
            {migrationNote}
          </div>
        )}

        {authError && (
          <div role="status" className="text-[11.5px] leading-snug text-[var(--destructive)]">
            {authError}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {open && isDesktop && (
        <aside
          aria-label="conversation history sidebar"
          className="w-[290px] shrink-0 border-r border-[var(--border)] bg-[var(--surface)]"
        >
          <div className="sticky top-14 h-[calc(100dvh-56px)]">{sidebarBody}</div>
        </aside>
      )}

      {open && !isDesktop && (
        <div
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="conversation history"
        >
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full w-[86vw] max-w-[310px] border-r border-[var(--border)] bg-[var(--surface)] shadow-xl">
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
}
