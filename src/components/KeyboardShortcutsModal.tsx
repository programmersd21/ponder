import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type KeyboardShortcutsModalProps = {
  open: boolean;
  onClose: () => void;
};

const SHORTCUTS = [
  { key: '/', description: 'Focus the question input' },
  { key: 'N', description: 'Start a new exploration' },
  { key: 'F', description: 'Toggle Focus reading mode' },
  { key: 'M', description: 'Toggle observatory sound cues' },
  { key: '?', description: 'Open or close keyboard shortcuts' },
  { key: 'Esc', description: 'Close open panels or cancel modal' },
];

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md rounded-[16px] border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h2 id="shortcuts-modal-title" className="font-display text-lg font-semibold text-[var(--foreground)]">
                  keyboard shortcuts
                </h2>
                <p className="text-[12px] text-[var(--muted-foreground)]">
                  Active when not typing in a text field
                </p>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                aria-label="close shortcuts dialog"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <dl className="mt-3 divide-y divide-[var(--border)]">
              {SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between py-2.5 text-sm">
                  <dt className="text-[var(--foreground)]">{s.description}</dt>
                  <dd>
                    <kbd className="inline-flex min-w-[28px] items-center justify-center rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface-secondary)] px-2 py-0.5 font-mono text-[12px] text-[var(--foreground)]">
                      {s.key}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
