import React from 'react';

type PonderLogoProps = {
  size?: number;
  spinning?: boolean;
  className?: string;
};

export function PonderLogo({ size = 24, spinning = false, className = '' }: PonderLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {/* Core planet */}
      <circle cx="16" cy="16" r="4.5" fill="currentColor" />

      {/* Tilted orbital path */}
      <ellipse
        cx="16"
        cy="16"
        rx="12.5"
        ry="5.2"
        transform="rotate(-26 16 16)"
        stroke="var(--accent)"
        strokeWidth="1.9"
        strokeLinecap="round"
      />

      {/* Orbiting satellite */}
      <g
        className={spinning ? 'origin-[16px_16px] animate-[ponder-orbit-spin_2.4s_linear_infinite]' : undefined}
      >
        <circle cx="26.2" cy="11.1" r="2.35" fill="currentColor" />
      </g>
    </svg>
  );
}
