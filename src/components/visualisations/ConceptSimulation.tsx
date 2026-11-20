import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { evaluateMathExpression, formatNumber } from '../../lib/mathParser.ts';
import type { VisualisationSpec } from '../../lib/schema.ts';

type ConceptSimSpec = Extract<VisualisationSpec, { type: 'concept_simulation' }>;

function getMoonPhaseInfo(angleDeg: number): {
  name: string;
  illuminationPct: number;
  dayInCycle: number;
  summary: string;
} {
  const norm = ((angleDeg % 360) + 360) % 360;
  const rad = (norm * Math.PI) / 180;
  const illum = ((1 - Math.cos(rad)) / 2) * 100;
  const dayInCycle = (norm / 360) * 29.53;

  if (norm < 12 || norm >= 348) {
    return {
      name: 'New Moon',
      illuminationPct: Math.round(illum),
      dayInCycle,
      summary:
        'The Moon sits between Earth and the Sun. Its sunlit half faces away from us, leaving the Earth-facing side in shadow.',
    };
  }
  if (norm < 78) {
    return {
      name: 'Waxing Crescent',
      illuminationPct: Math.round(illum),
      dayInCycle,
      summary:
        'Moving counter-clockwise from New Moon, a slim sliver of the sunlit hemisphere curves into view on the right.',
    };
  }
  if (norm < 102) {
    return {
      name: 'First Quarter',
      illuminationPct: Math.round(illum),
      dayInCycle,
      summary:
        'A quarter of the way through its orbit, we see half of the Moon’s sunlit side, and half of its night side, at a 90° angle to the Sun.',
    };
  }
  if (norm < 168) {
    return {
      name: 'Waxing Gibbous',
      illuminationPct: Math.round(illum),
      dayInCycle,
      summary:
        'More than half of the illuminated hemisphere now faces Earth as the Moon swings around behind us relative to the Sun.',
    };
  }
  if (norm < 192) {
    return {
      name: 'Full Moon',
      illuminationPct: Math.round(illum),
      dayInCycle,
      summary:
        'Earth sits roughly between the Sun and the Moon (its orbit is tilted ~5°, avoiding an eclipse most months), revealing the entire sunlit face.',
    };
  }
  if (norm < 258) {
    return {
      name: 'Waning Gibbous',
      illuminationPct: Math.round(illum),
      dayInCycle,
      summary:
        'Past Full Moon, the illuminated fraction begins shrinking from the right edge as the Moon continues its orbit.',
    };
  }
  if (norm < 282) {
    return {
      name: 'Third Quarter',
      illuminationPct: Math.round(illum),
      dayInCycle,
      summary:
        'Three-quarters through the lunar month, the Moon again sits at 90° to the Sun, now illuminating the left half from Earth’s view.',
    };
  }
  return {
    name: 'Waning Crescent',
    illuminationPct: Math.round(illum),
    dayInCycle,
    summary:
      'Near the end of the 29.5-day cycle, only a thin crescent on the left remains visible before returning to New Moon.',
  };
}

function buildMoonDiscLitPath(angleDeg: number, r: number): string {
  const norm = ((angleDeg % 360) + 360) % 360;
  const rad = (norm * Math.PI) / 180;
  const cos = Math.cos(rad);
  const rx = Math.abs(cos) * r;

  if (norm <= 1 || norm >= 359) {
    return '';
  }
  if (Math.abs(norm - 180) <= 1) {
    return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
  }

  const isWaxing = norm < 180;
  if (isWaxing) {
    // Right semicircle top -> bottom
    const outer = `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r}`;
    if (rx < 0.3) return `${outer} L 0 ${-r} Z`;
    const sweepBack = cos > 0 ? 0 : 1;
    return `${outer} A ${rx.toFixed(2)} ${r} 0 0 ${sweepBack} 0 ${-r} Z`;
  } else {
    // Left semicircle top -> bottom
    const outer = `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r}`;
    if (rx < 0.3) return `${outer} L 0 ${-r} Z`;
    const sweepBack = cos < 0 ? 0 : 1;
    return `${outer} A ${rx.toFixed(2)} ${r} 0 0 ${sweepBack} 0 ${-r} Z`;
  }
}

function MoonPhaseExplorer({ defaultAngle = 135 }: { defaultAngle?: number }) {
  const [angle, setAngle] = useState<number>(defaultAngle);
  const [playing, setPlaying] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!playing) return;
    let rafId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setAngle((prev) => (prev + dt * 38) % 360);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing]);

  const updateAngleFromPointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 320;
    const y = ((clientY - rect.top) / rect.height) * 218;
    const dx = x - 170;
    const dy = y - 109;
    // Matches cx - R cos(theta), cy + R sin(theta)
    const rawRad = Math.atan2(dy, -dx);
    const deg = ((rawRad * 180) / Math.PI + 360) % 360;
    setAngle(Math.round(deg));
  };

  const info = useMemo(() => getMoonPhaseInfo(angle), [angle]);
  const rad = (angle * Math.PI) / 180;
  const orbitR = 82;
  const earthX = 170;
  const earthY = 109;
  const moonX = earthX - orbitR * Math.cos(rad);
  const moonY = earthY + orbitR * Math.sin(rad);
  const moonR = 14;
  const litDiscPath = useMemo(() => buildMoonDiscLitPath(angle, 42), [angle]);

  const presets = [
    { label: 'New', deg: 0 },
    { label: 'First Qtr', deg: 90 },
    { label: 'Full', deg: 180 },
    { label: 'Third Qtr', deg: 270 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:items-center">
        {/* Top-down orbital view */}
        <div className="md:col-span-7">
          <div className="rounded-[12px] bg-[#181A1B] p-3 text-[#EBDBB2] border border-[#3C3836]">
            <div className="mb-1 flex items-center justify-between gap-2 px-1 text-[11px] font-mono text-[#A89984]">
              <span className="truncate">Top-down orbital view</span>
              <span className="shrink-0">Drag Moon</span>
            </div>
            <svg
              ref={svgRef}
              viewBox="0 0 320 218"
              role="img"
              aria-label={`Orbital diagram showing Moon at ${Math.round(angle)} degrees, producing ${info.name}`}
              onPointerDown={(e) => {
                setPlaying(false);
                draggingRef.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                updateAngleFromPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (!draggingRef.current) return;
                updateAngleFromPointer(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                draggingRef.current = false;
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
              className="w-full h-auto touch-none select-none cursor-grab active:cursor-grabbing"
            >
              <defs>
                <clipPath id="ponder-moon-orbit-clip">
                  <circle cx={moonX} cy={moonY} r={moonR} />
                </clipPath>
                <clipPath id="ponder-earth-clip">
                  <circle cx={earthX} cy={earthY} r={18} />
                </clipPath>
              </defs>

              {/* Sunlight rays from left */}
              <g stroke="#FABD2F" strokeOpacity="0.48" strokeWidth="1.2">
                {[38, 74, 109, 144, 180].map((yPos) => (
                  <g key={yPos}>
                    <line x1="8" y1={yPos} x2="46" y2={yPos} strokeDasharray="3 3" />
                    <polygon
                      points={`46,${yPos - 3} 52,${yPos} 46,${yPos + 3}`}
                      fill="#FABD2F"
                      fillOpacity="0.65"
                      stroke="none"
                    />
                  </g>
                ))}
              </g>
              <text
                x="10"
                y="21"
                fill="#FABD2F"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                SUNLIGHT
              </text>

              {/* Orbit circle */}
              <circle
                cx={earthX}
                cy={109}
                r={82}
                fill="none"
                stroke="#504945"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* Line of sight from Earth to Moon */}
              <line
                x1={earthX}
                y1={109}
                x2={earthX - 82 * Math.cos(rad)}
                y2={109 + 82 * Math.sin(rad)}
                stroke="#7C6F64"
                strokeWidth="1"
                strokeDasharray="2 3"
              />

              {/* Earth: always lit on left side facing Sun */}
              <g>
                <circle cx={earthX} cy={109} r={18} fill="#282828" stroke="#665C54" strokeWidth="1" />
                <rect
                  x={earthX - 18}
                  y={109 - 18}
                  width={18}
                  height={36}
                  fill="#83A598"
                  clipPath="url(#ponder-earth-clip)"
                />
                <circle cx={earthX} cy={109} r={18} fill="none" stroke="#A89984" strokeWidth="1" />
                <text
                  x={earthX}
                  y={140}
                  textAnchor="middle"
                  fill="#D5C4A1"
                  fontSize="10"
                  fontFamily="var(--font-sans)"
                >
                  Earth
                </text>
              </g>

              {/* Moon on orbit: ALWAYS lit on its left side (facing the Sun)! */}
              {(() => {
                const mx = earthX - 82 * Math.cos(rad);
                const my = 109 + 82 * Math.sin(rad);
                return (
                  <g>
                    <circle
                      cx={mx}
                      cy={my}
                      r={moonR + 5}
                      fill="transparent"
                      stroke="#8EC07C"
                      strokeOpacity="0.5"
                      strokeWidth="1"
                    />
                    <clipPath id="ponder-moon-orbit-clip-dyn">
                      <circle cx={mx} cy={my} r={moonR} />
                    </clipPath>
                    <circle cx={mx} cy={my} r={moonR} fill="#282828" />
                    <rect
                      x={mx - moonR}
                      y={my - moonR}
                      width={moonR}
                      height={moonR * 2}
                      fill="#EBDBB2"
                      clipPath="url(#ponder-moon-orbit-clip-dyn)"
                    />
                    <circle cx={mx} cy={my} r={moonR} fill="none" stroke="#D5C4A1" strokeWidth="1.2" />
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Earth perspective view + phase explanation (unboxed, clean typography) */}
        <div className="md:col-span-5 flex flex-col gap-3.5 min-w-0">
          <div className="flex items-center gap-4">
            <div className="shrink-0 rounded-full bg-[#181A1B] p-2.5 ring-1 ring-[#3C3836]">
              <svg
                width="72"
                height="72"
                viewBox="-50 -50 100 100"
                role="img"
                aria-label={`View from Earth: ${info.name}, ${info.illuminationPct}% illuminated`}
              >
                <circle cx="0" cy="0" r="42" fill="#282828" stroke="#504945" strokeWidth="1.5" />
                {litDiscPath && <path d={litDiscPath} fill="#EBDBB2" />}
              </svg>
            </div>

            <div className="min-w-0">
              <div className="font-mono text-[11px] text-[var(--muted-foreground)]">
                View from Earth
              </div>
              <div className="mt-0.5 font-display text-xl font-semibold leading-tight text-[var(--foreground)]">
                {info.name}
              </div>
              <div className="mt-1 font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">
                {info.illuminationPct}% lit · Day {info.dayInCycle.toFixed(1)} · {Math.round(angle)}°
              </div>
            </div>
          </div>

          <p className="text-[14px] leading-relaxed text-[var(--foreground)]">
            {info.summary}
          </p>

          <p className="text-[12px] leading-relaxed text-[var(--muted-foreground)]">
            Notice on the orbit: the Moon’s sunlit side always points toward the Sun, not Earth’s shadow.
          </p>
        </div>
      </div>

      {/* Controls bar */}
      <div className="space-y-3 border-t border-[var(--border)] pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="moon-orbit-angle-slider"
            className="text-[13px] font-medium text-[var(--foreground)]"
          >
            Orbital position
          </label>
          <span className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">
            {Math.round(angle)}° / 360°
          </span>
        </div>

        <input
          id="moon-orbit-angle-slider"
          type="range"
          min={0}
          max={360}
          step={1}
          value={Math.round(angle)}
          onChange={(e) => {
            setPlaying(false);
            setAngle(Number(e.target.value));
          }}
          className="ponder-slider"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="lunar phase presets">
            {presets.map((preset) => {
              const isNear = Math.abs((((angle - preset.deg + 540) % 360) - 180)) < 12;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setAngle(preset.deg);
                  }}
                  className={`min-h-[36px] rounded-[8px] border px-2.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isNear
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--foreground)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {playing ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
              <span>{playing ? 'Pause' : 'Animate orbit'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setAngle(defaultAngle);
              }}
              aria-label="reset moon orbit"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GravityOrbitSimulation() {
  const [mass, setMass] = useState(1.0); // Earth/Star mass multiplier
  const [radius, setRadius] = useState(1.0); // AU / orbital radius multiplier
  const [theta, setTheta] = useState(0.6);
  const [playing, setPlaying] = useState(true);

  // Kepler's 3rd Law & orbital velocity (normalized to Earth around Sun = 1)
  const orbitalSpeed = Math.sqrt(mass / radius); // v ~ sqrt(M/r)
  const periodYears = Math.sqrt(Math.pow(radius, 3) / mass); // T = sqrt(r^3 / M)
  const gravityForce = mass / (radius * radius); // F ~ M / r^2

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Angular velocity omega = v / r
      const omega = (orbitalSpeed / radius) * 0.9;
      setTheta((prev) => (prev + dt * omega) % (Math.PI * 2));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, orbitalSpeed, radius]);

  const svgOrbitR = 32 + ((radius - 0.5) / 2.0) * 68;
  const starR = 11 + Math.min(10, mass * 3.5);
  const cx = 160;
  const cy = 120;
  const px = cx + svgOrbitR * Math.cos(theta);
  const py = cy + svgOrbitR * Math.sin(theta);

  // Velocity tangent vector (perpendicular to radius)
  const vScale = Math.min(44, 18 * orbitalSpeed);
  const vx = -Math.sin(theta) * vScale;
  const vy = Math.cos(theta) * vScale;

  // Gravity pull vector toward center
  const fScale = Math.min(42, 16 * Math.sqrt(gravityForce));
  const fx = -Math.cos(theta) * fScale;
  const fy = -Math.sin(theta) * fScale;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7 rounded-[14px] border border-[#3C3836] bg-[#181A1B] p-3">
          <svg
            viewBox="0 0 320 240"
            role="img"
            aria-label={`Orbital simulation: central mass ${mass.toFixed(1)}x, radius ${radius.toFixed(1)}x`}
            className="w-full h-auto"
          >
            <circle
              cx={cx}
              cy={cy}
              r={svgOrbitR}
              fill="none"
              stroke="#504945"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <circle cx={cx} cy={cy} r={starR} fill="#FABD2F" />
            <text
              x={cx}
              y={cy + starR + 14}
              textAnchor="middle"
              fill="#D5C4A1"
              fontSize="10"
              fontFamily="var(--font-sans)"
            >
              Central mass
            </text>

            {/* Gravity vector toward star */}
            <line
              x1={px}
              y1={py}
              x2={px + fx}
              y2={py + fy}
              stroke="#83A598"
              strokeWidth="2"
            />
            {/* Velocity tangent vector */}
            <line
              x1={px}
              y1={py}
              x2={px + vx}
              y2={py + vy}
              stroke="#8EC07C"
              strokeWidth="2"
            />
            <circle cx={px} cy={py} r="7" fill="#EBDBB2" stroke="#D79921" strokeWidth="2" />
          </svg>
          <div className="mt-1 flex flex-wrap items-center gap-4 px-1 text-[11px] font-mono text-[#D5C4A1]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 bg-[#8EC07C]" /> Tangential velocity
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 bg-[#83A598]" /> Gravitational pull
            </span>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5">
              <div className="text-[12px] text-[var(--muted-foreground)]">Orbital speed</div>
              <div className="font-mono text-lg font-medium text-[var(--foreground)] tabular-nums">
                {(orbitalSpeed * 29.78).toFixed(1)} km/s
              </div>
            </div>
            <div className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5">
              <div className="text-[12px] text-[var(--muted-foreground)]">Orbital period</div>
              <div className="font-mono text-lg font-medium text-[var(--foreground)] tabular-nums">
                {periodYears.toFixed(2)} Earth yrs
              </div>
            </div>
            <div className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5">
              <div className="text-[12px] text-[var(--muted-foreground)]">Relative pull</div>
              <div className="font-mono text-lg font-medium text-[var(--foreground)] tabular-nums">
                {gravityForce.toFixed(2)}× Earth-Sun
              </div>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed text-[var(--muted-foreground)]">
            An orbit is a continuous balance: gravity pulls the body inward while forward velocity carries it sideways around the curve.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
        <div>
          <div className="flex justify-between text-[13px]">
            <label htmlFor="orbit-mass-slider" className="font-medium">
              Central mass
            </label>
            <span className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">
              {mass.toFixed(1)} M☉
            </span>
          </div>
          <input
            id="orbit-mass-slider"
            type="range"
            min={0.5}
            max={3.0}
            step={0.1}
            value={mass}
            onChange={(e) => setMass(Number(e.target.value))}
            className="ponder-slider mt-1"
          />
        </div>
        <div>
          <div className="flex justify-between text-[13px]">
            <label htmlFor="orbit-radius-slider" className="font-medium">
              Orbital distance
            </label>
            <span className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">
              {radius.toFixed(1)} AU
            </span>
          </div>
          <input
            id="orbit-radius-slider"
            type="range"
            min={0.5}
            max={2.5}
            step={0.1}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="ponder-slider mt-1"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          <span>{playing ? 'Pause' : 'Play'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMass(1.0);
            setRadius(1.0);
            setTheta(0.6);
            setPlaying(true);
          }}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
}

function WaveSimulation() {
  const [frequency, setFrequency] = useState(440); // Hz
  const [amplitude, setAmplitude] = useState(0.7); // 0.1..1
  const [phaseDeg, setPhaseDeg] = useState(0); // 0..360

  const speedOfSound = 343; // m/s at 20°C
  const wavelengthM = speedOfSound / frequency;
  const periodMs = 1000 / frequency;

  // Build SVG wave path across 0..560
  const cyclesShown = (frequency / 220) * 2.2;
  const buildWavePath = (ampScale: number, extraPhaseRad: number) => {
    const pts: string[] = [];
    const width = 560;
    const midY = 90;
    const maxAmpPx = 62;
    for (let x = 0; x <= width; x += 4) {
      const t = (x / width) * cyclesShown * Math.PI * 2;
      const y = midY - Math.sin(t + extraPhaseRad) * amplitude * maxAmpPx * ampScale;
      pts.push(`${x === 0 ? 'M' : 'L'} ${x} ${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const wave1 = buildWavePath(1, 0);
  const wave2 = phaseDeg !== 0 ? buildWavePath(1, (phaseDeg * Math.PI) / 180) : null;

  return (
    <div className="space-y-5">
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
        <svg
          viewBox="0 0 560 180"
          role="img"
          aria-label={`Wave visualization at ${frequency} Hz and ${(amplitude * 100).toFixed(0)}% amplitude`}
          className="w-full h-auto"
        >
          <line x1="0" y1="90" x2="560" y2="90" stroke="var(--border-strong)" strokeDasharray="4 4" />
          {wave2 && (
            <path
              d={wave2}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth="1.75"
              strokeDasharray="5 4"
            />
          )}
          <path d={wave1} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5">
          <div className="text-[12px] text-[var(--muted-foreground)]">Wavelength (in air)</div>
          <div className="font-mono text-base font-medium text-[var(--foreground)] tabular-nums">
            {wavelengthM.toFixed(2)} m
          </div>
        </div>
        <div className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5">
          <div className="text-[12px] text-[var(--muted-foreground)]">Wave period</div>
          <div className="font-mono text-base font-medium text-[var(--foreground)] tabular-nums">
            {periodMs.toFixed(2)} ms
          </div>
        </div>
        <div className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5">
          <div className="text-[12px] text-[var(--muted-foreground)]">Pitch perception</div>
          <div className="font-mono text-base font-medium text-[var(--foreground)]">
            {frequency < 260 ? 'Low' : frequency < 550 ? 'Midrange' : 'High'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-3">
        <div>
          <div className="flex justify-between text-[13px]">
            <label htmlFor="wave-freq-slider" className="font-medium">Frequency</label>
            <span className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">{frequency} Hz</span>
          </div>
          <input
            id="wave-freq-slider"
            type="range"
            min={110}
            max={880}
            step={10}
            value={frequency}
            onChange={(e) => setFrequency(Number(e.target.value))}
            className="ponder-slider mt-1"
          />
        </div>
        <div>
          <div className="flex justify-between text-[13px]">
            <label htmlFor="wave-amp-slider" className="font-medium">Amplitude</label>
            <span className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">{Math.round(amplitude * 100)}%</span>
          </div>
          <input
            id="wave-amp-slider"
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={amplitude}
            onChange={(e) => setAmplitude(Number(e.target.value))}
            className="ponder-slider mt-1"
          />
        </div>
        <div>
          <div className="flex justify-between text-[13px]">
            <label htmlFor="wave-phase-slider" className="font-medium">Comparison phase</label>
            <span className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">{phaseDeg}°</span>
          </div>
          <input
            id="wave-phase-slider"
            type="range"
            min={0}
            max={180}
            step={15}
            value={phaseDeg}
            onChange={(e) => setPhaseDeg(Number(e.target.value))}
            className="ponder-slider mt-1"
          />
        </div>
      </div>
    </div>
  );
}

function ParametricSystemSimulation({ spec }: { spec: ConceptSimSpec }) {
  const params = spec.parameters ?? [];
  const outputs = spec.outputs ?? [];

  const initialValues = useMemo(() => {
    const obj: Record<string, number> = {};
    for (const p of params) obj[p.id] = p.defaultValue;
    return obj;
  }, [params]);

  const [values, setValues] = useState<Record<string, number>>(initialValues);

  const computed = useMemo(() => {
    return outputs.map((o) => {
      const val = evaluateMathExpression(o.expression, values);
      return { ...o, value: val };
    });
  }, [outputs, values]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {computed.map((out) => (
          <div
            key={out.id}
            className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-secondary)] p-4"
          >
            <div className="text-[12px] text-[var(--muted-foreground)]">{out.label}</div>
            <div className="mt-1 font-mono text-2xl font-medium text-[var(--foreground)] tabular-nums">
              {out.value !== null ? formatNumber(out.value, 3) : ','}{' '}
              {out.unit && <span className="text-sm text-[var(--muted-foreground)]">{out.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
        {params.map((p) => {
          const val = values[p.id] ?? p.defaultValue;
          return (
            <div key={p.id}>
              <div className="flex justify-between text-[13px]">
                <label htmlFor={`sim-param-${p.id}`} className="font-medium">
                  {p.label}
                </label>
                <span className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">
                  {val} {p.unit}
                </span>
              </div>
              <input
                id={`sim-param-${p.id}`}
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={val}
                onChange={(e) => setValues((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
                className="ponder-slider mt-1"
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setValues(initialValues)}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
}

export function ConceptSimulation({ spec }: { spec: ConceptSimSpec }) {
  switch (spec.mode) {
    case 'moon_phases':
      return <MoonPhaseExplorer defaultAngle={spec.defaultAngle ?? 135} />;
    case 'gravity_orbit':
      return <GravityOrbitSimulation />;
    case 'wave_interference':
      return <WaveSimulation />;
    case 'parametric_system':
      return <ParametricSystemSimulation spec={spec} />;
  }
}
