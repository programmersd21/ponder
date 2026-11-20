import { z } from 'zod';
import { isValidMathExpression } from './mathParser.ts';

const safeString = (maxLen = 600) => z.string().trim().min(1).max(maxLen);
const finiteNumber = z.number().refine((v) => Number.isFinite(v), {
  message: 'Number must be finite',
});

export type ExplorationDepth = 'quick' | 'standard' | 'deep';
export type ResearchMode = 'auto' | 'always' | 'off';

export const ParameterSchema = z.object({
  id: z.string().trim().min(1).max(32).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  label: safeString(64),
  min: finiteNumber,
  max: finiteNumber,
  step: finiteNumber.refine((v) => v > 0, { message: 'step must be positive' }),
  defaultValue: finiteNumber,
  unit: z.string().trim().max(24).default(''),
});

export type ParameterSpec = z.infer<typeof ParameterSchema>;

export const InteractiveGraphSchema = z.object({
  type: z.literal('interactive_graph'),
  title: safeString(100),
  description: z.string().trim().max(280).optional(),
  xLabel: safeString(48),
  yLabel: safeString(48),
  xMin: finiteNumber,
  xMax: finiteNumber,
  yMin: finiteNumber,
  yMax: finiteNumber,
  series: z
    .array(
      z.object({
        id: safeString(32),
        label: safeString(60),
        expression: safeString(180),
        colorRole: z.enum(['accent', 'primary', 'success', 'warning']).optional(),
      })
    )
    .min(1)
    .max(3),
  parameters: z.array(ParameterSchema).max(4).default([]),
  showTangentAtX: z.boolean().optional(),
  defaultTangentX: finiteNumber.optional(),
});

export const ExperimentSliderSchema = z.object({
  type: z.literal('experiment_slider'),
  title: safeString(100),
  description: z.string().trim().max(280).optional(),
  parameters: z.array(ParameterSchema).min(1).max(4),
  outputs: z
    .array(
      z.object({
        id: safeString(32),
        label: safeString(60),
        expression: safeString(180),
        unit: z.string().trim().max(24).default(''),
        precision: z.number().int().min(0).max(5).optional(),
      })
    )
    .min(1)
    .max(3),
  insightRules: z
    .array(
      z.object({
        outputId: safeString(32),
        below: finiteNumber.optional(),
        above: finiteNumber.optional(),
        message: safeString(180),
      })
    )
    .max(6)
    .optional(),
});

export const StepExplorerSchema = z.object({
  type: z.literal('step_explorer'),
  title: safeString(100),
  description: z.string().trim().max(280).optional(),
  steps: z
    .array(
      z.object({
        title: safeString(80),
        operation: safeString(120),
        explanation: safeString(400),
        state: z
          .array(
            z.object({
              label: safeString(48),
              value: safeString(80),
              highlight: z.boolean().optional(),
            })
          )
          .max(10)
          .default([]),
      })
    )
    .min(2)
    .max(10),
});

export const TimelineSchema = z.object({
  type: z.literal('timeline'),
  title: safeString(100),
  description: z.string().trim().max(280).optional(),
  events: z
    .array(
      z.object({
        date: safeString(40),
        title: safeString(80),
        summary: safeString(320),
        significance: z.string().trim().max(160).optional(),
      })
    )
    .min(2)
    .max(10),
});

export const ComparisonSchema = z.object({
  type: z.literal('comparison'),
  title: safeString(100),
  description: z.string().trim().max(280).optional(),
  items: z.array(safeString(60)).min(2).max(4),
  rows: z
    .array(
      z.object({
        dimension: safeString(60),
        values: z.array(safeString(220)).min(2).max(4),
      })
    )
    .min(2)
    .max(8),
});

export const DiagramElementSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('circle'),
    cx: finiteNumber,
    cy: finiteNumber,
    r: finiteNumber.refine((v) => v > 0),
    fill: z.enum(['none', 'surface', 'accent-subtle', 'accent', 'muted']).optional(),
    stroke: z.enum(['border', 'strong', 'foreground', 'accent', 'warning']).optional(),
    dashed: z.boolean().optional(),
    label: z.string().trim().max(48).optional(),
  }),
  z.object({
    kind: z.literal('rect'),
    x: finiteNumber,
    y: finiteNumber,
    width: finiteNumber.refine((v) => v > 0),
    height: finiteNumber.refine((v) => v > 0),
    rx: finiteNumber.optional(),
    fill: z.enum(['none', 'surface', 'accent-subtle', 'accent', 'muted']).optional(),
    stroke: z.enum(['border', 'strong', 'foreground', 'accent', 'warning']).optional(),
    label: z.string().trim().max(48).optional(),
  }),
  z.object({
    kind: z.literal('line'),
    x1: finiteNumber,
    y1: finiteNumber,
    x2: finiteNumber,
    y2: finiteNumber,
    arrow: z.boolean().optional(),
    dashed: z.boolean().optional(),
    stroke: z.enum(['border', 'strong', 'foreground', 'accent', 'warning']).optional(),
    label: z.string().trim().max(48).optional(),
  }),
]);

export const LabelledDiagramSchema = z.object({
  type: z.literal('labelled_diagram'),
  title: safeString(100),
  description: z.string().trim().max(280).optional(),
  width: finiteNumber.refine((v) => v >= 200 && v <= 1000).default(640),
  height: finiteNumber.refine((v) => v >= 160 && v <= 700).default(360),
  elements: z.array(DiagramElementSchema).min(1).max(32),
  hotspots: z
    .array(
      z.object({
        id: safeString(32),
        label: safeString(60),
        x: finiteNumber,
        y: finiteNumber,
        description: safeString(320),
        metric: z.string().trim().max(48).optional(),
      })
    )
    .min(2)
    .max(10),
});

export const CalculatorSchema = z.object({
  type: z.literal('calculator'),
  title: safeString(100),
  description: z.string().trim().max(280).optional(),
  formulaDisplay: safeString(140),
  inputs: z.array(ParameterSchema).min(1).max(4),
  outputs: z
    .array(
      z.object({
        id: safeString(32),
        label: safeString(60),
        expression: safeString(180),
        unit: z.string().trim().max(24).default(''),
        precision: z.number().int().min(0).max(5).optional(),
      })
    )
    .min(1)
    .max(3),
  presets: z
    .array(
      z.object({
        label: safeString(48),
        values: z.record(z.string(), finiteNumber),
      })
    )
    .max(4)
    .optional(),
});

export const ConceptSimulationSchema = z.object({
  type: z.literal('concept_simulation'),
  mode: z.enum(['moon_phases', 'gravity_orbit', 'wave_interference', 'parametric_system']),
  title: safeString(100),
  description: z.string().trim().max(280).optional(),
  defaultAngle: finiteNumber.optional(),
  parameters: z.array(ParameterSchema).max(4).optional(),
  outputs: z
    .array(
      z.object({
        id: safeString(32),
        label: safeString(60),
        expression: safeString(180),
        unit: z.string().trim().max(24).default(''),
      })
    )
    .max(4)
    .optional(),
});

export const VisualisationSpecSchema = z.discriminatedUnion('type', [
  InteractiveGraphSchema,
  ExperimentSliderSchema,
  StepExplorerSchema,
  TimelineSchema,
  ComparisonSchema,
  LabelledDiagramSchema,
  CalculatorSchema,
  ConceptSimulationSchema,
]);

export type VisualisationSpec = z.infer<typeof VisualisationSpecSchema>;

export const ExplanationSectionSchema = z.object({
  heading: safeString(120),
  content: safeString(2200),
});

export const GlossaryTermSchema = z.object({
  term: safeString(64),
  definition: safeString(320),
});

export type GlossaryTerm = z.infer<typeof GlossaryTermSchema>;

export const UnderstandingCheckSchema = z.object({
  question: safeString(240),
  options: z.array(safeString(160)).min(2).max(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: safeString(360),
});

export type UnderstandingCheck = z.infer<typeof UnderstandingCheckSchema>;

export const CitationSchema = z.object({
  id: safeString(32),
  title: safeString(200),
  url: z.string().trim().url().max(600),
  publisher: z.string().trim().max(120).optional(),
  snippet: z.string().trim().max(400).optional(),
  retrievedAt: z.string().trim().max(40),
});

export type Citation = z.infer<typeof CitationSchema>;

export const MediaAssetSchema = z.object({
  kind: z.enum(['sourced_image', 'generated_illustration']),
  url: z.string().trim().url().max(1000),
  sourceUrl: z.string().trim().url().max(1000).optional(),
  title: safeString(180),
  caption: safeString(360),
  alt: safeString(240),
  attribution: z.string().trim().max(240).optional(),
  license: z.string().trim().max(120).optional(),
});

export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const GenerationMetaSchema = z.object({
  model: z.string().trim().max(80),
  fallbackUsed: z.boolean().optional(),
  notice: z.string().trim().max(260).optional(),
  researched: z.boolean().optional(),
  researchNote: z.string().trim().max(260).optional(),
  generatedAt: z.string().trim().max(40),
});

export const ExplanationSchema = z.object({
  question: safeString(1000),
  title: safeString(160),
  shortAnswer: safeString(1200),
  sections: z.array(ExplanationSectionSchema).min(1).max(8),
  keyTakeaway: safeString(500),
  keyTakeaways: z.array(safeString(260)).max(5).optional(),
  visualisation: VisualisationSpecSchema.nullable(),
  suggestedFollowUps: z.array(safeString(200)).max(6).default([]),
  depth: z.enum(['quick', 'standard', 'deep']).optional(),
  glossary: z.array(GlossaryTermSchema).max(10).optional(),
  understandingChecks: z.array(UnderstandingCheckSchema).max(4).optional(),
  citations: z.array(CitationSchema).max(15).optional(),
  media: MediaAssetSchema.nullable().optional(),
  generationMeta: GenerationMetaSchema.optional(),
});

export type Explanation = z.infer<typeof ExplanationSchema>;

function sanitizeParameters(params: ParameterSpec[]): ParameterSpec[] {
  return params.map((p) => {
    const min = Math.min(p.min, p.max);
    const max = p.max > min ? p.max : min + 1;
    const step =
      p.step > 0 && p.step <= max - min
        ? p.step
        : Number(((max - min) / 20).toPrecision(2)) || 1;
    const defaultValue = Math.min(Math.max(p.defaultValue, min), max);
    return { ...p, min, max, step, defaultValue };
  });
}

export function validateVisualisationStrict(raw: unknown): VisualisationSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = VisualisationSpecSchema.safeParse(raw);
  if (!parsed.success) return null;

  const spec = parsed.data;

  switch (spec.type) {
    case 'interactive_graph': {
      const parameters = sanitizeParameters(spec.parameters);
      const allowedVars = ['x', ...parameters.map((p) => p.id)];
      const validSeries = spec.series.filter((s) => isValidMathExpression(s.expression, allowedVars));
      if (validSeries.length === 0) return null;
      const xMin = Math.min(spec.xMin, spec.xMax);
      const xMax = spec.xMax > xMin ? spec.xMax : xMin + 10;
      const yMin = Math.min(spec.yMin, spec.yMax);
      const yMax = spec.yMax > yMin ? spec.yMax : yMin + 10;
      return { ...spec, xMin, xMax, yMin, yMax, parameters, series: validSeries };
    }
    case 'experiment_slider': {
      const parameters = sanitizeParameters(spec.parameters);
      const allowedVars = parameters.map((p) => p.id);
      const validOutputs = spec.outputs.filter((o) => isValidMathExpression(o.expression, allowedVars));
      if (validOutputs.length === 0) return null;
      return { ...spec, parameters, outputs: validOutputs };
    }
    case 'calculator': {
      const inputs = sanitizeParameters(spec.inputs);
      const allowedVars = inputs.map((p) => p.id);
      const validOutputs = spec.outputs.filter((o) => isValidMathExpression(o.expression, allowedVars));
      if (validOutputs.length === 0) return null;
      return { ...spec, inputs, outputs: validOutputs };
    }
    case 'comparison': {
      const itemCount = spec.items.length;
      const cleanRows = spec.rows.map((r) => ({
        dimension: r.dimension,
        values: r.values.slice(0, itemCount),
      }));
      if (cleanRows.some((r) => r.values.length < itemCount)) return null;
      return { ...spec, rows: cleanRows };
    }
    case 'concept_simulation': {
      const parameters = spec.parameters ? sanitizeParameters(spec.parameters) : undefined;
      if (spec.mode === 'parametric_system') {
        if (!parameters || parameters.length === 0 || !spec.outputs || spec.outputs.length === 0) {
          return null;
        }
        const allowedVars = parameters.map((p) => p.id);
        const validOutputs = spec.outputs.filter((o) => isValidMathExpression(o.expression, allowedVars));
        if (validOutputs.length === 0) return null;
        return { ...spec, parameters, outputs: validOutputs };
      }
      return { ...spec, parameters };
    }
    default:
      return spec;
  }
}

export function validateExplanationPayload(
  raw: unknown,
  originalQuestion: string
): Explanation {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Response payload is not an object');
  }

  const candidate = raw as Record<string, unknown>;
  const safeVis = validateVisualisationStrict(candidate.visualisation);

  const sanitizedChecks = Array.isArray(candidate.understandingChecks)
    ? candidate.understandingChecks
        .map((c) => {
          if (!c || typeof c !== 'object') return null;
          const obj = c as Record<string, unknown>;
          const opts = Array.isArray(obj.options) ? obj.options : [];
          const idx = typeof obj.correctIndex === 'number' ? obj.correctIndex : 0;
          return {
            ...obj,
            correctIndex: Math.min(Math.max(0, Math.round(idx)), Math.max(0, opts.length - 1)),
          };
        })
        .filter(Boolean)
    : undefined;

  const parsed = ExplanationSchema.safeParse({
    ...candidate,
    question: originalQuestion.trim(),
    visualisation: safeVis,
    understandingChecks: sanitizedChecks,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid explanation format: ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`
    );
  }

  return parsed.data;
}

export type ExplorationTurn = {
  id: string;
  question: string;
  explanation: Explanation;
  depth?: ExplorationDepth;
  createdAt: number;
};

export type ExplorationThread = {
  id: string;
  title: string;
  pinned?: boolean;
  depth?: ExplorationDepth;
  turns: ExplorationTurn[];
  createdAt?: number;
  updatedAt: number;
};

export type SavedExplorationItem = {
  id: string;
  conversationId: string;
  turnId: string;
  title: string;
  question: string;
  savedAt: number;
};

export type SharedSnapshot = {
  id: string;
  question: string;
  title: string;
  explanation: Explanation;
  schemaVersion: number;
  createdAt: number;
};
