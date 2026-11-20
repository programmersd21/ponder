import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  soundEngine,
  type SoundIntensity,
  type SoundPreferences,
} from '../lib/soundEngine.ts';

type SoundPreferencesPopoverProps = {
  prefs: SoundPreferences;
  onChange: (next: SoundPreferences) => void;
};

export function SoundPreferencesPopover({ prefs, onChange }: SoundPreferencesPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggleSound = () => {
    const nextEnabled = !prefs.enabled;
    const updated = soundEngine.updatePreferences({ enabled: nextEnabled }, true);
    onChange(updated);
    if (nextEnabled) {
      soundEngine.play('ui.toggle', true);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          soundEngine.play('ui.press', true);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={prefs.enabled ? 'Sound cues on , open audio preferences' : 'Sound cues off , open audio preferences'}
        title={prefs.enabled ? 'Observatory sound cues: On' : 'Observatory sound cues: Off'}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-[9px] border transition-colors duration-150 cursor-pointer shrink-0 ${
          prefs.enabled
            ? 'border-[var(--accent)]/60 bg-[var(--accent-subtle)] text-[var(--accent)]'
            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]'
        }`}
      >
        {prefs.enabled ? (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <VolumeX className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="sound preferences"
            className="fixed inset-x-3 top-16 z-50 rounded-[14px] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-elevated)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-72"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Observatory sound
                </div>
                <div className="text-[12px] text-[var(--muted-foreground)]">
                  Subtle procedural audio cues
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.enabled}
                onClick={toggleSound}
                className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-colors cursor-pointer shrink-0 ${
                  prefs.enabled
                    ? 'border-[var(--accent)] bg-[var(--accent)]'
                    : 'border-[var(--border-strong)] bg-[var(--surface-secondary)]'
                }`}
              >
                <span className="sr-only">toggle sound effects</span>
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-[var(--surface-elevated)] shadow-sm transition-transform duration-150 ${
                    prefs.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-3">
              <div>
                <div className="flex items-center justify-between text-[12px]">
                  <label htmlFor="ponder-sound-volume" className="text-[var(--muted-foreground)]">
                    Volume
                  </label>
                  <span className="font-mono text-[var(--foreground)] tabular-nums">
                    {Math.round(prefs.volume * 100)}%
                  </span>
                </div>
                <input
                  id="ponder-sound-volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={prefs.volume}
                  disabled={!prefs.enabled}
                  onChange={(e) => {
                    const updated = soundEngine.updatePreferences(
                      { volume: Number(e.target.value) },
                      true
                    );
                    onChange(updated);
                  }}
                  className="ponder-slider mt-1 disabled:opacity-45"
                />
              </div>

              <div>
                <div className="mb-1.5 text-[12px] text-[var(--muted-foreground)]">
                  Sound intensity
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-[9px] border border-[var(--border)] bg-[var(--surface-secondary)] p-1">
                  {(['subtle', 'balanced'] as SoundIntensity[]).map((mode) => {
                    const active = prefs.intensity === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        disabled={!prefs.enabled}
                        onClick={() => {
                          const updated = soundEngine.updatePreferences({ intensity: mode }, true);
                          onChange(updated);
                          soundEngine.play('feedback.success', true);
                        }}
                        className={`min-h-[30px] rounded-[6px] text-[12px] font-medium capitalize transition-colors cursor-pointer disabled:opacity-45 ${
                          active
                            ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm'
                            : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>

              {prefs.enabled && (
                <button
                  type="button"
                  onClick={() => soundEngine.play('learning.discovery', true)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-secondary)] py-1.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] transition-colors cursor-pointer"
                >
                  Preview discovery chime
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
