import React, { useState } from 'react';
import type { VisualisationSpec } from '../../lib/schema.ts';

type DiagramSpec = Extract<VisualisationSpec, { type: 'labelled_diagram' }>;

const FILL_MAP: Record<string, string> = {
  none: 'transparent',
  surface: 'var(--surface)',
  'accent-subtle': 'var(--accent-subtle)',
  accent: 'var(--accent)',
  muted: 'var(--surface-tertiary)',
};

const STROKE_MAP: Record<string, string> = {
  border: 'var(--border)',
  strong: 'var(--border-strong)',
  foreground: 'var(--foreground)',
  accent: 'var(--accent)',
  warning: 'var(--warning)',
};

export function DiagramView({ spec }: { spec: DiagramSpec }) {
  const [selectedId, setSelectedId] = useState<string>(spec.hotspots[0]?.id ?? '');
  const activeHotspot =
    spec.hotspots.find((h) => h.id === selectedId) ?? spec.hotspots[0];

  const markerId = `ponder-arrow-${spec.title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8 rounded-[14px] border border-[var(--border)] bg-[var(--surface-secondary)] p-2 sm:p-3">
          <svg
            viewBox={`0 0 ${spec.width} ${spec.height}`}
            role="img"
            aria-label={`Interactive labelled diagram: ${spec.title}`}
            className="w-full h-auto"
          >
            <defs>
              <marker
                id={markerId}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--foreground)" />
              </marker>
            </defs>

            {/* Geometric Elements */}
            {spec.elements.map((el, idx) => {
              if (el.kind === 'circle') {
                return (
                  <g key={idx}>
                    <circle
                      cx={el.cx}
                      cy={el.cy}
                      r={el.r}
                      fill={FILL_MAP[el.fill ?? 'none']}
                      stroke={STROKE_MAP[el.stroke ?? 'strong']}
                      strokeWidth="1.75"
                      strokeDasharray={el.dashed ? '5 4' : undefined}
                    />
                    {el.label && (
                      <text
                        x={el.cx}
                        y={el.cy + 4}
                        textAnchor="middle"
                        fill="var(--foreground)"
                        fontSize="12"
                        fontFamily="var(--font-sans)"
                      >
                        {el.label}
                      </text>
                    )}
                  </g>
                );
              }
              if (el.kind === 'rect') {
                return (
                  <g key={idx}>
                    <rect
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      rx={el.rx ?? 8}
                      fill={FILL_MAP[el.fill ?? 'surface']}
                      stroke={STROKE_MAP[el.stroke ?? 'strong']}
                      strokeWidth="1.75"
                    />
                    {el.label && (
                      <text
                        x={el.x + el.width / 2}
                        y={el.y + el.height / 2 + 4}
                        textAnchor="middle"
                        fill="var(--foreground)"
                        fontSize="12"
                        fontFamily="var(--font-sans)"
                      >
                        {el.label}
                      </text>
                    )}
                  </g>
                );
              }
              // line
              const midX = (el.x1 + el.x2) / 2;
              const midY = (el.y1 + el.y2) / 2;
              return (
                <g key={idx}>
                  <line
                    x1={el.x1}
                    y1={el.y1}
                    x2={el.x2}
                    y2={el.y2}
                    stroke={STROKE_MAP[el.stroke ?? 'foreground']}
                    strokeWidth="2"
                    strokeDasharray={el.dashed ? '5 4' : undefined}
                    markerEnd={el.arrow ? `url(#${markerId})` : undefined}
                  />
                  {el.label && (
                    <text
                      x={midX}
                      y={midY - 8}
                      textAnchor="middle"
                      fill="var(--muted-foreground)"
                      fontSize="11"
                      fontFamily="var(--font-mono)"
                    >
                      {el.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Interactive Hotspots */}
            {spec.hotspots.map((spot, idx) => {
              const isSelected = activeHotspot?.id === spot.id;
              return (
                <g
                  key={spot.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect ${spot.label}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(spot.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(spot.id);
                    }
                  }}
                  className="cursor-pointer focus:outline-none"
                >
                  <circle
                    cx={spot.x}
                    cy={spot.y}
                    r={isSelected ? 17 : 13}
                    fill={isSelected ? 'var(--accent)' : 'var(--surface)'}
                    stroke="var(--accent)"
                    strokeWidth="2"
                  />
                  <text
                    x={spot.x}
                    y={spot.y + 4}
                    textAnchor="middle"
                    fill={isSelected ? 'var(--accent-foreground)' : 'var(--foreground)'}
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="var(--font-mono)"
                  >
                    {idx + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hotspot Inspector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {spec.hotspots.map((spot, idx) => {
              const isSelected = activeHotspot?.id === spot.id;
              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => setSelectedId(spot.id)}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--foreground)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <span className="font-mono text-[11px]">{idx + 1}.</span>
                  <span>{spot.label}</span>
                </button>
              );
            })}
          </div>

          {activeHotspot && (
            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-secondary)] p-4 space-y-2">
              <div className="font-display text-base font-semibold text-[var(--foreground)]">
                {activeHotspot.label}
              </div>
              {activeHotspot.metric && (
                <div className="font-mono text-[12px] text-[var(--accent)]">
                  {activeHotspot.metric}
                </div>
              )}
              <p className="text-[13px] leading-relaxed text-[var(--foreground)]">
                {activeHotspot.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
