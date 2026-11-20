import React, { useEffect, useRef } from 'react';

type AtmosphereProps = {
  /** 'hero' fills a hero section; 'page' is a subtle fixed layer behind everything. */
  variant?: 'hero' | 'page';
  className?: string;
};

/**
 * A warm, editorial ambient background inspired by the animated gradient
 * backdrops popularised by shadcn.io — but built from pure CSS so it stays
 * lightweight and on-brand. It keeps Ponder's ivory / stone-grey identity,
 * drifts on slow loops, and leans gently toward the pointer.
 */
export function Atmosphere({ variant = 'hero', className = '' }: AtmosphereProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = rootRef.current;
    if (!root) return;

    let raf = 0;
    let tx = 50;
    let ty = 40;
    let cx = 50;
    let cy = 40;

    const onMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      tx = ((e.clientX - rect.left) / rect.width) * 100;
      ty = ((e.clientY - rect.top) / rect.height) * 100;
    };

    const tick = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      root.style.setProperty('--pointer-x', `${cx}%`);
      root.style.setProperty('--pointer-y', `${cy}%`);
      raf = requestAnimationFrame(tick);
    };

    root.addEventListener('pointermove', onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      root.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={`ponder-atmosphere ponder-atmosphere--${variant} ${className}`}
    >
      <div className="ponder-atmo-blob ponder-atmo-blob--a" />
      <div className="ponder-atmo-blob ponder-atmo-blob--b" />
      <div className="ponder-atmo-blob ponder-atmo-blob--c" />
      <div className="ponder-atmo-pointer" />
      <div className="ponder-atmo-grain" />
    </div>
  );
}
