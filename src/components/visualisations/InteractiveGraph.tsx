import React, { useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  compileMathExpression,
  evalMathAst,
  formatNumber,
  numericalDerivative,
} from '../../lib/mathParser.ts';
import type { VisualisationSpec } from '../../lib/schema.ts';

type GraphSpec = Extract<VisualisationSpec, { type: 'interactive_graph' }>;

const ROLE_COLORS: Record<string, string> = {
  accent: 'var(--accent)',
  primary: 'var(--foreground)',
  success: 'var(--success)',
  warning: 'var(--warning)',
};

export function InteractiveGraph({ spec }: { spec: GraphSpec }) {
  const initialParams = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of spec.parameters) map[p.id] = p.defaultValue;
    return map;
  }, [spec.parameters]);

  const [params, setParams] = useState<Record<string, number>>(initialParams);
  const [inspectX, setInspectX] = useState<number>(
    spec.defaultTangentX ?? (spec.xMin + spec.xMax) / 2
  );
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 620;
  const height = 300;
  const pad = { top: 20, right: 20, bottom: 38, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const toPxX = (x: number) =>
    pad.left + ((x - spec.xMin) / (spec.xMax - spec.xMin)) * plotW;
  const toPxY = (y: number) =>
    pad.top + ((spec.yMax - y) / (spec.yMax - spec.yMin)) * plotH;

  const compiledSeries = useMemo(() => {
    return spec.series.map((s) => {
      try {
        return { ...s, ast: compileMathExpression(s.expression) };
      } catch {
        return { ...s, ast: null };
      }
    });
  }, [spec.series]);

  const paths = useMemo(() => {
    const samples = 160;
    return compiledSeries.map((s) => {
      if (!s.ast) return { id: s.id, d: '', color: ROLE_COLORS[s.colorRole ?? 'accent'] };
      const segments: string[] = [];
      let penDown = false;
      const span = spec.yMax - spec.yMin;
      for (let i = 0; i <= samples; i++) {
        const x = spec.xMin + (i / samples) * (spec.xMax - spec.xMin);
        const y = evalMathAst(s.ast, { ...params, x });
        if (!Number.isFinite(y) || y < spec.yMin - span * 3 || y > spec.yMax + span * 3) {
          penDown = false;
          continue;
        }
        const px = toPxX(x);
        const py = toPxY(y);
        segments.push(`${penDown ? 'L' : 'M'} ${px.toFixed(1)} ${py.toFixed(1)}`);
        penDown = true;
      }
      return {
        id: s.id,
        d: segments.join(' '),
        color: ROLE_COLORS[s.colorRole ?? 'accent'] ?? 'var(--accent)',
      };
    });
  }, [compiledSeries, params, spec.xMin, spec.xMax, spec.yMin, spec.yMax]);

  const inspectedValues = useMemo(() => {
    return compiledSeries.map((s) => {
      if (!s.ast) return { id: s.id, label: s.label, y: null, slope: null, color: ROLE_COLORS[s.colorRole ?? 'accent'] };
      const y = evalMathAst(s.ast, { ...params, x: inspectX });
      const slope = spec.showTangentAtX ? numericalDerivative(s.ast, inspectX, params) : null;
      return {
        id: s.id,
        label: s.label,
        y: Number.isFinite(y) ? y : null,
        slope,
        color: ROLE_COLORS[s.colorRole ?? 'accent'] ?? 'var(--accent)',
      };
    });
  }, [compiledSeries, params, inspectX, spec.showTangentAtX]);

  // Tangent line segment for the first series if enabled
  const tangentSegment = useMemo(() => {
    if (!spec.showTangentAtX) return null;
    const first = inspectedValues[0];
    if (!first || first.y === null || first.slope === null) return null;
    const span = (spec.xMax - spec.xMin) * 0.22;
    const x1 = inspectX - span;
    const y1 = first.y + first.slope * (x1 - inspectX);
    const x2 = inspectX + span;
    const y2 = first.y + first.slope * (x2 - inspectX);
    return {
      x1: toPxX(x1),
      y1: toPxY(y1),
      x2: toPxX(x2),
      y2: toPxY(y2),
      cx: toPxX(inspectX),
      cy: toPxY(first.y),
    };
  }, [spec.showTangentAtX, inspectedValues, inspectX, spec.xMin, spec.xMax]);

  const xTicks = useMemo(() => {
    const count = 4;
    return Array.from({ length: count + 1 }, (_, i) => spec.xMin + (i / count) * (spec.xMax - spec.xMin));
  }, [spec.xMin, spec.xMax]);

  const yTicks = useMemo(() => {
    const count = 4;
    return Array.from({ length: count + 1 }, (_, i) => spec.yMin + (i / count) * (spec.yMax - spec.yMin));
  }, [spec.yMin, spec.yMax]);

  const zeroX = spec.xMin <= 0 && spec.xMax >= 0 ? toPxX(0) : null;
  const zeroY = spec.yMin <= 0 && spec.yMax >= 0 ? toPxY(0) : null;
  const plotClipId = `ponder-plot-${spec.title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;

  const handlePointer = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * width;
    const ratio = Math.min(1, Math.max(0, (svgX - pad.left) / plotW));
    const xVal = spec.xMin + ratio * (spec.xMax - spec.xMin);
    setInspectX(Number(xVal.toFixed(2)));
  };

  return (
    <div className="space-y-4">
      {/* Legend & live readout */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[13px]">
          {inspectedValues.map((item) => (
            <div key={item.id} className="inline-flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="font-medium text-[var(--foreground)]">{item.label}</span>
              <span className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">
                = {item.y !== null ? formatNumber(item.y, 2) : ','}
              </span>
            </div>
          ))}
        </div>

        <div className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">
          {spec.xLabel} = {formatNumber(inspectX, 2)}
          {spec.showTangentAtX && inspectedValues[0]?.slope !== null && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="text-[var(--foreground)]">
                slope = {formatNumber(inspectedValues[0].slope!, 2)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* SVG Graph */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-secondary)] p-2 sm:p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Interactive graph: ${spec.title}`}
          onPointerMove={(e) => {
            if (e.buttons === 1 || e.pointerType === 'mouse') {
              handlePointer(e.clientX);
            }
          }}
          onPointerDown={(e) => handlePointer(e.clientX)}
          className="w-full h-auto touch-pan-y cursor-crosshair select-none"
        >
          <defs>
            <clipPath id={plotClipId}>
              <rect x={pad.left} y={pad.top} width={plotW} height={plotH} />
            </clipPath>
          </defs>
          {/* Grid lines */}
          {xTicks.map((t, idx) => (
            <g key={`xt-${idx}`}>
              <line
                x1={toPxX(t)}
                y1={pad.top}
                x2={toPxX(t)}
                y2={height - pad.bottom}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={toPxX(t)}
                y={height - pad.bottom + 16}
                textAnchor="middle"
                fill="var(--muted-foreground)"
                fontSize="11"
                fontFamily="var(--font-mono)"
              >
                {formatNumber(t, 2)}
              </text>
            </g>
          ))}

          {yTicks.map((t, idx) => (
            <g key={`yt-${idx}`}>
              <line
                x1={pad.left}
                y1={toPxY(t)}
                x2={width - pad.right}
                y2={toPxY(t)}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={pad.left - 8}
                y={toPxY(t) + 4}
                textAnchor="end"
                fill="var(--muted-foreground)"
                fontSize="11"
                fontFamily="var(--font-mono)"
              >
                {formatNumber(t, 2)}
              </text>
            </g>
          ))}

          {/* Axes */}
          {zeroX !== null && (
            <line
              x1={zeroX}
              y1={pad.top}
              x2={zeroX}
              y2={height - pad.bottom}
              stroke="var(--border-strong)"
              strokeWidth="1.5"
            />
          )}
          {zeroY !== null && (
            <line
              x1={pad.left}
              y1={zeroY}
              x2={width - pad.right}
              y2={zeroY}
              stroke="var(--border-strong)"
              strokeWidth="1.5"
            />
          )}

          {/* Axis labels */}
          <text
            x={width / 2}
            y={height - 4}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize="11"
            fontFamily="var(--font-sans)"
          >
            {spec.xLabel}
          </text>

          {/* Inspection vertical guideline */}
          <line
            x1={toPxX(inspectX)}
            y1={pad.top}
            x2={toPxX(inspectX)}
            y2={height - pad.bottom}
            stroke="var(--muted-foreground)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Plotted Curves + Tangent */}
          <g clipPath={`url(#${plotClipId})`}>
            {paths.map((p) => (
              <path
                key={p.id}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {tangentSegment && (
              <line
                x1={tangentSegment.x1}
                y1={tangentSegment.y1}
                x2={tangentSegment.x2}
                y2={tangentSegment.y2}
                stroke="var(--warning)"
                strokeWidth="2"
                strokeDasharray="5 3"
              />
            )}
          </g>

          {/* Inspected point dots */}
          {inspectedValues.map((item) => {
            if (item.y === null || item.y < spec.yMin || item.y > spec.yMax) return null;
            return (
              <circle
                key={`dot-${item.id}`}
                cx={toPxX(inspectX)}
                cy={toPxY(item.y)}
                r="5"
                fill="var(--surface)"
                stroke={item.color}
                strokeWidth="2.5"
              />
            );
          })}
        </svg>
      </div>

      {/* Scrub & parameter sliders */}
      <div className="space-y-4 pt-1">
        <div>
          <div className="flex justify-between text-[13px]">
            <label htmlFor={`graph-scrub-${spec.title}`} className="font-medium">
              Inspect {spec.xLabel}
            </label>
            <span className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">
              {formatNumber(inspectX, 2)}
            </span>
          </div>
          <input
            id={`graph-scrub-${spec.title}`}
            type="range"
            min={spec.xMin}
            max={spec.xMax}
            step={(spec.xMax - spec.xMin) / 80}
            value={inspectX}
            onChange={(e) => setInspectX(Number(e.target.value))}
            className="ponder-slider mt-1"
          />
        </div>

        {spec.parameters.length > 0 && (
          <div className="grid grid-cols-1 gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
            {spec.parameters.map((p) => {
              const val = params[p.id] ?? p.defaultValue;
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-[13px]">
                    <label htmlFor={`graph-param-${p.id}`} className="font-medium">
                      {p.label}
                    </label>
                    <span className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">
                      {formatNumber(val, 3)} {p.unit}
                    </span>
                  </div>
                  <input
                    id={`graph-param-${p.id}`}
                    type="range"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={val}
                    onChange={(e) =>
                      setParams((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))
                    }
                    className="ponder-slider mt-1"
                  />
                </div>
              );
            })}
          </div>
        )}

        {spec.parameters.length > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setParams(initialParams);
                setInspectX(spec.defaultTangentX ?? (spec.xMin + spec.xMax) / 2);
              }}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
