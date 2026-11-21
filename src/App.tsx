import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AppHeader, type AppView } from './components/AppHeader.tsx';
import { Atmosphere } from './components/Atmosphere.tsx';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { LearningWorkspace } from './components/LearningWorkspace.tsx';
import { GeminiSetup } from './components/GeminiSetup.tsx';
import { GeminiSettings } from './components/GeminiSettings.tsx';
import { ShareView } from './components/ShareView.tsx';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  testConnection,
} from './lib/firebase.ts';
import {
  createPublicShareSnapshot,
  deleteAllAccountDataInFirestore,
  deleteConversationInFirestore,
  fetchConversationTurns,
  fetchPrivateNote,
  fetchSavedExplorations,
  fetchUserConversations,
  migrateGuestDataToAccount,
  persistConversationTurn,
  removeSavedExplorationBookmark,
  renameConversationInFirestore,
  saveExplorationBookmark,
  savePrivateNote,
  syncUserProfileOnLogin,
  togglePinConversationInFirestore,
} from './lib/firestoreStore.ts';
import { exportThreadAsPdf } from './lib/pdfExport.ts';
import type {
  ExplorationDepth,
  ExplorationThread,
  ExplorationTurn,
  ResearchMode,
  SavedExplorationItem,
} from './lib/schema.ts';
import { WHY_MOON_PHASES_EXPLANATION } from './lib/showcaseData.ts';
import { soundEngine, type SoundPreferences } from './lib/soundEngine.ts';
import {
  applyTheme,
  clearGuestData,
  clearGuestThreads,
  getSavedDepth,
  getSavedTheme,
  hasMigratedGuestData,
  loadGuestNotesMap,
  loadGuestSaved,
  loadGuestThreads,
  markGuestDataMigrated,
  saveDepthPreference,
  saveGuestNotesMap,
  saveGuestSaved,
  saveGuestThreads,
  type ThemePreference,
} from './lib/storage.ts';

function parseShareIdFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/share\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  const initialShareId = parseShareIdFromPath();

  const [view, setView] = useState<AppView>(initialShareId ? 'share' : 'landing');
  const [shareId, setShareId] = useState<string | null>(initialShareId);
  const [theme, setTheme] = useState<ThemePreference>(() => getSavedTheme());
  const [depth, setDepth] = useState<ExplorationDepth>(() => getSavedDepth());
  const [researchMode, setResearchMode] = useState<ResearchMode>('auto');
  const [soundPrefs, setSoundPrefs] = useState<SoundPreferences>(() =>
    soundEngine.getPreferences()
  );

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [migrationNote, setMigrationNote] = useState<string | null>(null);

  const [threads, setThreads] = useState<ExplorationThread[]>(() => loadGuestThreads());
  const [savedItems, setSavedItems] = useState<SavedExplorationItem[]>(() => loadGuestSaved());
  const [notesMap, setNotesMap] = useState<Record<string, string>>(() => loadGuestNotesMap());

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loadingThreadTurns, setLoadingThreadTurns] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [focusMode, setFocusMode] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Delegated sound effects for sliders and controls
  useEffect(() => {
    const onInput = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.getAttribute && target.getAttribute('type') === 'range') {
        soundEngine.play('ui.press', true);
      }
    };
    document.addEventListener('input', onInput, true);
    return () => document.removeEventListener('input', onInput, true);
  }, []);

  const refreshGeminiStatus = useCallback(async (freshToken?: string | null) => {
    try {
      const authHeader = freshToken || idToken;
      const opts = authHeader ? { headers: { Authorization: `Bearer ${authHeader}` } } : undefined;
      const [gRes, sRes] = await Promise.all([
        fetch('/api/gemini/status', opts),
        fetch('/api/serper/status', opts),
      ]);
      const gData = (await gRes.json()) as { configured?: boolean };
      const sData = (await sRes.json()) as { configured?: boolean };
      setGeminiConfigured(Boolean(gData.configured && sData.configured));
    } catch {
      setGeminiConfigured(false);
    }
  }, [idToken]);

  useEffect(() => {
    void refreshGeminiStatus();
  }, [refreshGeminiStatus, user]);

  useEffect(() => {
    saveDepthPreference(depth);
  }, [depth]);

  // Listen to browser navigation (/share/:id <-> /)
  useEffect(() => {
    const handlePopState = () => {
      const nextShareId = parseShareIdFromPath();
      if (nextShareId) {
        setShareId(nextShareId);
        setView('share');
      } else {
        setShareId(null);
        setView((prev) => (prev === 'share' ? 'workspace' : prev));
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Initialize Firestore connection check and Firebase Auth listener
  useEffect(() => {
    void testConnection();
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setAuthError(null);
      setMigrationNote(null);

      let token: string | null = null;
      if (nextUser) {
        try {
          token = await nextUser.getIdToken();
          setIdToken(token);
        } catch {
          setIdToken(null);
        }
      } else {
        setIdToken(null);
      }

      if (nextUser) {
        try {
          // One-time promotion of the temp/guest workspace (chats, saved
          // explorations, notes and API credentials) into this account.
          if (!hasMigratedGuestData(nextUser.uid)) {
            const guestThreads = loadGuestThreads();
            const guestSaved = loadGuestSaved();
            const guestNotes = loadGuestNotesMap();
            const hasGuestData =
              guestThreads.length > 0 || guestSaved.length > 0 || Object.keys(guestNotes).length > 0;

            try {
              // Credentials first — the server reads the guest cookies, so this
              // must happen before anything clears them.
              if (token) {
                await fetch('/api/account/migrate-credentials', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken: token }),
                }).catch(() => undefined);
              }

              if (hasGuestData) {
                const result = await migrateGuestDataToAccount(
                  nextUser.uid,
                  guestThreads,
                  guestSaved,
                  guestNotes
                );
                const parts: string[] = [];
                if (result.conversations) parts.push(`${result.conversations} chats`);
                if (result.saved) parts.push(`${result.saved} saved`);
                if (result.notes) parts.push(`${result.notes} notes`);
                if (parts.length) {
                  setMigrationNote(`moved your temp workspace to your account: ${parts.join(', ')}`);
                }
              }
              markGuestDataMigrated(nextUser.uid);
              clearGuestData();
            } catch (err) {
              console.error('Failed to migrate guest workspace:', err);
              setAuthError('Signed in, but could not move your temporary chats. They are still on this device.');
            }
          }

          await syncUserProfileOnLogin(nextUser, {
            theme,
            preferredDepth: depth,
            soundEnabled: soundPrefs.enabled,
            soundVolume: soundPrefs.volume,
            soundIntensity: soundPrefs.intensity,
          });
          const [cloudConvs, cloudSaved] = await Promise.all([
            fetchUserConversations(nextUser.uid),
            fetchSavedExplorations(nextUser.uid),
          ]);
          setThreads(cloudConvs);
          setSavedItems(cloudSaved);
          setNotesMap({});
          setActiveThreadId((prevId) => {
            if (prevId && cloudConvs.some((c) => c.id === prevId)) return prevId;
            return null;
          });
          void refreshGeminiStatus(token);
        } catch (err) {
          console.error('Failed to sync cloud workspace:', err);
          setAuthError('Signed in, but could not load cloud history. Check network connection.');
        }
      } else {
        setThreads(loadGuestThreads());
        setSavedItems(loadGuestSaved());
        setNotesMap(loadGuestNotesMap());
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy load turns + private note when selecting a cloud thread without loaded turns
  useEffect(() => {
    if (!user || !activeThreadId || activeThreadId === 'moon_showcase') return;
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread) return;

    let cancelled = false;

    const loadDetails = async () => {
      if (thread.turns.length === 0) {
        setLoadingThreadTurns(true);
        try {
          const loadedTurns = await fetchConversationTurns(user.uid, activeThreadId);
          if (!cancelled) {
            setThreads((prev) =>
              prev.map((t) => (t.id === activeThreadId ? { ...t, turns: loadedTurns } : t))
            );
          }
        } catch (err) {
          console.error('Failed to load conversation messages:', err);
        } finally {
          if (!cancelled) setLoadingThreadTurns(false);
        }
      }

      if (notesMap[activeThreadId] === undefined) {
        const noteText = await fetchPrivateNote(activeThreadId);
        if (!cancelled) {
          setNotesMap((prev) => ({ ...prev, [activeThreadId]: noteText }));
        }
      }
    };

    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [user, activeThreadId, threads, notesMap]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const handleSoundPrefsChange = useCallback((next: SoundPreferences) => {
    const updated = soundEngine.updatePreferences(next, true);
    setSoundPrefs(updated);
  }, []);

  const handleSignIn = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user') return;
      setAuthError(
        code === 'auth/popup-blocked'
          ? 'Pop-up blocked by browser. Allow pop-ups to sign in with Google.'
          : code === 'auth/unauthorized-domain'
            ? 'This domain is not authorized for Google sign-in. Add localhost to Firebase Authentication authorized domains.'
            : 'Google sign-in failed. Please try again.'
      );
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setAuthError(null);
    try {
      await signOutUser();
      setActiveThreadId(null);
    } catch {
      setAuthError('Could not sign out right now.');
    }
  }, []);

  const handleNavigateView = useCallback((nextView: AppView) => {
    if (nextView !== 'share' && window.location.pathname.startsWith('/share/')) {
      window.history.pushState(null, '', '/');
      setShareId(null);
    }
    setFocusMode(false);
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleStartExploring = useCallback((initialQuestion?: string) => {
    if (window.location.pathname.startsWith('/share/')) {
      window.history.pushState(null, '', '/');
      setShareId(null);
    }
    setView('workspace');
    setFocusMode(false);
    if (initialQuestion) {
      setActiveThreadId(null);
      setPendingQuestion(initialQuestion);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleNewExploration = useCallback(() => {
    if (window.location.pathname.startsWith('/share/')) {
      window.history.pushState(null, '', '/');
      setShareId(null);
    }
    setActiveThreadId(null);
    setPendingQuestion(null);
    setFocusMode(false);
    setView('workspace');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    requestAnimationFrame(() => composerInputRef.current?.focus());
  }, []);

  const ensureCloudMoonThread = useCallback(
    async (ownerUid: string, existingThread: ExplorationThread): Promise<string> => {
      const firstTurn = existingThread.turns[0];
      const { conversationId, title } = await persistConversationTurn(ownerUid, null, firstTurn);
      const promoted: ExplorationThread = {
        ...existingThread,
        id: conversationId,
        title,
      };
      setThreads((prev) => [promoted, ...prev.filter((t) => t.id !== 'moon_showcase')]);
      setActiveThreadId(conversationId);
      return conversationId;
    },
    []
  );

  const handleOpenMoonDemo = useCallback(() => {
    handleStartExploring('How do sound waves work?');
  }, [handleStartExploring]);

  const handleSaveTurn = useCallback(
    async (turn: ExplorationTurn, targetThreadId: string | null): Promise<string> => {
      if (user) {
        let targetConvId = targetThreadId;
        const existingThread = targetThreadId
          ? threads.find((t) => t.id === targetThreadId) ?? null
          : null;

        // If user is following up on the local Moon showcase while signed in, persist Moon first
        if (targetThreadId === 'moon_showcase' && existingThread && existingThread.turns[0]) {
          targetConvId = await ensureCloudMoonThread(user.uid, existingThread);
        }

        const existingCount = existingThread?.turns.length ?? 0;
        const { conversationId, title } = await persistConversationTurn(
          user.uid,
          targetConvId,
          turn,
          existingThread?.title,
          existingCount
        );

        setThreads((prev) => {
          const existing = prev.find((t) => t.id === conversationId);
          if (existing) {
            const updated: ExplorationThread = {
              ...existing,
              turns: [...existing.turns, turn],
              updatedAt: Date.now(),
            };
            return [updated, ...prev.filter((t) => t.id !== conversationId)];
          }
          const created: ExplorationThread = {
            id: conversationId,
            title,
            pinned: false,
            depth: turn.depth ?? 'standard',
            turns: [turn],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          return [created, ...prev];
        });
        setActiveThreadId(conversationId);
        return conversationId;
      }

      // Guest Mode local persistence
      let resolvedId = targetThreadId;
      setThreads((prev) => {
        let next: ExplorationThread[];
        if (targetThreadId) {
          const existing = prev.find((t) => t.id === targetThreadId);
          if (existing) {
            const updated: ExplorationThread = {
              ...existing,
              turns: [...existing.turns, turn],
              updatedAt: Date.now(),
            };
            next = [updated, ...prev.filter((t) => t.id !== targetThreadId)];
          } else {
            resolvedId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            next = [
              {
                id: resolvedId,
                title: turn.explanation.title,
                turns: [turn],
                depth: turn.depth ?? 'standard',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
              ...prev,
            ];
          }
        } else {
          resolvedId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          next = [
            {
              id: resolvedId,
              title: turn.explanation.title,
              turns: [turn],
              depth: turn.depth ?? 'standard',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            ...prev,
          ];
        }
        saveGuestThreads(next);
        return next;
      });

      if (resolvedId) {
        setActiveThreadId(resolvedId);
      }
      return resolvedId ?? '';
    },
    [user, threads, ensureCloudMoonThread]
  );

  const handleRenameThread = useCallback(
    async (threadId: string, nextTitle: string) => {
      if (user && threadId !== 'moon_showcase') {
        await renameConversationInFirestore(threadId, nextTitle);
      }
      setThreads((prev) => {
        const next = prev.map((t) =>
          t.id === threadId ? { ...t, title: nextTitle, updatedAt: Date.now() } : t
        );
        if (!user) saveGuestThreads(next);
        return next;
      });
    },
    [user]
  );

  const handleTogglePin = useCallback(
    async (threadId: string, nextPinned: boolean) => {
      if (user && threadId !== 'moon_showcase') {
        await togglePinConversationInFirestore(threadId, nextPinned);
      }
      setThreads((prev) => {
        const next = prev.map((t) => (t.id === threadId ? { ...t, pinned: nextPinned } : t));
        if (!user) saveGuestThreads(next);
        return next;
      });
    },
    [user]
  );

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      if (user && threadId !== 'moon_showcase') {
        await deleteConversationInFirestore(user.uid, threadId);
      }
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== threadId);
        if (!user) saveGuestThreads(next);
        return next;
      });
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
      }
    },
    [user, activeThreadId]
  );

  const handleExportThreadPdf = useCallback(
    async (threadId: string) => {
      const target = threads.find((t) => t.id === threadId);
      if (!target) return;
      if (target.turns.length === 0 && user && threadId !== 'moon_showcase') {
        const loadedTurns = await fetchConversationTurns(user.uid, threadId);
        if (loadedTurns.length > 0) {
          exportThreadAsPdf({ ...target, turns: loadedTurns });
          return;
        }
      }
      if (target.turns.length > 0) {
        exportThreadAsPdf(target);
      }
    },
    [threads, user]
  );

  const handleToggleSaveTurn = useCallback(
    async (turn: ExplorationTurn) => {
      const existing = savedItems.find((s) => s.turnId === turn.id);
      if (existing) {
        if (user) {
          await removeSavedExplorationBookmark(existing.id);
        }
        setSavedItems((prev) => {
          const next = prev.filter((s) => s.id !== existing.id);
          if (!user) saveGuestSaved(next);
          return next;
        });
        return;
      }

      let convId = activeThreadId ?? 'local';
      if (user && convId === 'moon_showcase') {
        const moonThread = threads.find((t) => t.id === 'moon_showcase');
        if (moonThread) {
          convId = await ensureCloudMoonThread(user.uid, moonThread);
        }
      }

      const itemPayload = {
        id: `sav_${turn.id}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
        conversationId: convId,
        turnId: turn.id,
        title: turn.explanation.title,
        question: turn.question,
      };

      if (user) {
        const saved = await saveExplorationBookmark(user.uid, itemPayload);
        setSavedItems((prev) => [saved, ...prev]);
      } else {
        const saved: SavedExplorationItem = { ...itemPayload, savedAt: Date.now() };
        setSavedItems((prev) => {
          const next = [saved, ...prev];
          saveGuestSaved(next);
          return next;
        });
      }
    },
    [savedItems, activeThreadId, user, threads, ensureCloudMoonThread]
  );

  const handleRemoveSaved = useCallback(
    async (savedId: string) => {
      if (user) {
        await removeSavedExplorationBookmark(savedId);
      }
      setSavedItems((prev) => {
        const next = prev.filter((s) => s.id !== savedId);
        if (!user) saveGuestSaved(next);
        return next;
      });
    },
    [user]
  );

  const handleShareTurn = useCallback(
    async (turn: ExplorationTurn) => {
      if (!user) {
        return { status: 'needs_signin' as const };
      }
      try {
        const id = await createPublicShareSnapshot(user.uid, turn);
        const shareUrl = `${window.location.origin}/share/${id}`;
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(shareUrl);
            return { url: shareUrl, status: 'copied' as const };
          }
          return { url: shareUrl, status: 'manual' as const };
        } catch {
          return { url: shareUrl, status: 'manual' as const };
        }
      } catch (err) {
        return {
          status: 'error' as const,
          error: err instanceof Error ? err.message : 'Could not publish public snapshot.',
        };
      }
    },
    [user]
  );

  const handleSaveNote = useCallback(
    async (conversationId: string, content: string) => {
      let targetConvId = conversationId;
      if (user && conversationId === 'moon_showcase') {
        const moonThread = threads.find((t) => t.id === 'moon_showcase');
        if (moonThread) {
          targetConvId = await ensureCloudMoonThread(user.uid, moonThread);
        }
      }
      if (user) {
        await savePrivateNote(user.uid, targetConvId, content);
        setNotesMap((prev) => ({ ...prev, [targetConvId]: content }));
      } else {
        setNotesMap((prev) => {
          const next = { ...prev, [targetConvId]: content };
          saveGuestNotesMap(next);
          return next;
        });
      }
    },
    [user, threads, ensureCloudMoonThread]
  );

  const handleDeleteAllData = useCallback(async () => {
    // Clear the UI immediately so the action feels instant.
    setThreads([]);
    setSavedItems([]);
    setNotesMap({});
    setActiveThreadId(null);
    if (user) {
      try {
        await deleteAllAccountDataInFirestore(user.uid);
      } catch (err) {
        console.error('Failed to delete all cloud data:', err);
        setAuthError('Could not fully delete cloud data. Please try again.');
      }
    } else {
      clearGuestThreads();
      saveGuestSaved([]);
      saveGuestNotesMap({});
    }
  }, [user]);

  // Global keyboard shortcuts (when not typing in form controls)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }

      if (e.key === '?' && view === 'workspace') {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      } else if (e.key === '/' && view === 'workspace') {
        e.preventDefault();
        composerInputRef.current?.focus();
      } else if ((e.key === 'n' || e.key === 'N') && view === 'workspace') {
        e.preventDefault();
        handleNewExploration();
      } else if ((e.key === 'f' || e.key === 'F') && view === 'workspace' && activeThreadId) {
        e.preventDefault();
        setFocusMode((v) => !v);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const next = soundEngine.updatePreferences({ enabled: !soundPrefs.enabled }, true);
        setSoundPrefs(next);
      } else if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, activeThreadId, soundPrefs.enabled, focusMode, handleNewExploration]);

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  if (geminiConfigured === null) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] text-[var(--muted-foreground)]">
          Loading ponder...
        </div>
      </MotionConfig>
    );
  }

  if (geminiConfigured === false) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
          <GeminiSetup idToken={idToken} onConfigured={() => void refreshGeminiStatus()} />
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
        <Atmosphere variant="page" />
        {!focusMode && (
          <AppHeader
            view={view}
            theme={theme}
            onToggleTheme={toggleTheme}
            soundPrefs={soundPrefs}
            onSoundPrefsChange={handleSoundPrefsChange}
            onNavigateView={handleNavigateView}
            onNewExploration={handleNewExploration}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            sidebarOpen={sidebarOpen}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            user={user}
            onSignIn={handleSignIn}
            hasActiveExploration={Boolean(activeThread)}
          />
        )}

        <AnimatePresence mode="wait">
          {view === 'share' && shareId ? (
            <motion.div key="share" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="relative z-10">
              <ShareView
                shareId={shareId}
                onExitShare={() => handleNavigateView('workspace')}
              />
            </motion.div>
          ) : view === 'landing' ? (
            <motion.div key="landing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="relative z-10">
              <LandingPage
                onStartExploring={handleStartExploring}
                onOpenMoonDemo={handleOpenMoonDemo}
                onNavigateView={handleNavigateView}
              />
            </motion.div>
          ) : (
            <motion.div key="workspace" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="relative z-10">
              <LearningWorkspace
            threads={threads}
            savedItems={savedItems}
            activeThread={activeThread}
            activeThreadId={activeThreadId}
            pendingQuestion={pendingQuestion}
            onConsumePendingQuestion={() => setPendingQuestion(null)}
            onSaveTurn={handleSaveTurn}
            onSelectThread={(id) => {
              setActiveThreadId(id);
              setView('workspace');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onStartNewExploration={handleNewExploration}
            onRenameThread={handleRenameThread}
            onTogglePin={handleTogglePin}
            onDeleteThread={handleDeleteThread}
            onExportThreadPdf={(id) => void handleExportThreadPdf(id)}
            onToggleSaveTurn={handleToggleSaveTurn}
            onRemoveSaved={handleRemoveSaved}
            onShareTurn={handleShareTurn}
            noteContent={activeThreadId ? (notesMap[activeThreadId] ?? '') : ''}
            onSaveNote={handleSaveNote}
            sidebarOpen={sidebarOpen}
            onCloseSidebarMobile={() => setSidebarOpen(false)}
            focusMode={focusMode}
            onToggleFocusMode={() => setFocusMode((v) => !v)}
            depth={depth}
            onDepthChange={setDepth}
            researchMode={researchMode}
            onResearchModeChange={setResearchMode}
            user={user}
            authReady={authReady}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onDeleteAllData={handleDeleteAllData}
            authError={authError}
            migrationNote={migrationNote}
            idToken={idToken}
            composerInputRef={composerInputRef}
            loadingThreadTurns={loadingThreadTurns}
          />
            </motion.div>
        )}
        </AnimatePresence>

        <GeminiSettings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          idToken={idToken}
          onStatusChange={() => void refreshGeminiStatus()}
        />

        <KeyboardShortcutsModal
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />
      </div>
    </MotionConfig>
  );
}
