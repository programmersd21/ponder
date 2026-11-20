import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  type Citation,
  type Explanation,
  type ExplorationDepth,
  type ResearchMode,
  validateExplanationPayload,
} from '../lib/schema.ts';
import { searchSourcedEducationalImage } from './media.ts';
import { searchSerper, searchSerperImages } from './serper.ts';

export type FollowUpContextTurn = {
  question: string;
  title: string;
  shortAnswer: string;
  visualisationType?: string | null;
};

export type GeminiErrorCategory =
  | 'RATE_LIMITED'
  | 'QUOTA_EXHAUSTED'
  | 'MODEL_UNAVAILABLE'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'AUTH_ERROR'
  | 'SAFETY_BLOCK'
  | 'MODEL_NOT_FOUND'
  | 'CLIENT_ABORTED'
  | 'INTERNAL_ERROR';

export type StructuredGeminiError = {
  category: GeminiErrorCategory;
  message: string;
  statusCode: number;
  retryable: boolean;
};

export type ResearchStage =
  | 'Thinking'
  | 'Researching'
  | 'Reading sources'
  | 'Synthesizing'
  | 'Complete';

export type StreamCallbacks = {
  onStatus: (stage: ResearchStage, detail: string) => void;
  onPartial: (partial: {
    title?: string;
    shortAnswer?: string;
    sections?: { heading: string; content: string }[];
  }) => void;
  onComplete: (explanation: Explanation) => void;
  onError: (err: StructuredGeminiError) => void;
};

export const MODEL_REGISTRY = {
  'gemini-4-hydrogen': {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    supportsStreaming: true,
    supportsJsonSchema: true,
    supportsGoogleSearch: true,
    requiresPaidKey: false,
  },
  'gemini-4-neon': {
    id: 'gemini-4-neon',
    label: 'Gemini 4 Neon',
    supportsStreaming: true,
    supportsJsonSchema: true,
    supportsGoogleSearch: true,
    requiresPaidKey: false,
  },
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    supportsStreaming: true,
    supportsJsonSchema: true,
    supportsGoogleSearch: true,
    requiresPaidKey: false,
  },
  'gemini-3.7-flash': {
    id: 'gemini-3.7-flash',
    label: 'Gemini 3.7 Flash',
    supportsStreaming: true,
    supportsJsonSchema: true,
    supportsGoogleSearch: true,
    requiresPaidKey: false,
  },
  'gemini-3.6-flash': {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    supportsStreaming: true,
    supportsJsonSchema: true,
    supportsGoogleSearch: true,
    requiresPaidKey: false,
  },
  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    supportsStreaming: true,
    supportsJsonSchema: true,
    supportsGoogleSearch: true,
    requiresPaidKey: false,
  },
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    supportsStreaming: true,
    supportsJsonSchema: true,
    supportsGoogleSearch: true,
    requiresPaidKey: false,
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    supportsStreaming: true,
    supportsJsonSchema: true,
    supportsGoogleSearch: true,
    requiresPaidKey: false,
  },
  'gemini-2.5-flash-lite': {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite',
    supportsStreaming: true,
    supportsJsonSchema: true,
    supportsGoogleSearch: true,
    requiresPaidKey: false,
  },
} as const;

const PRIMARY_MODEL_ID = MODEL_REGISTRY['gemini-4-hydrogen'].id;
const FALLBACK_MODEL_ID = MODEL_REGISTRY['gemini-3.5-flash-lite'].id;
const REQUEST_TIMEOUT_MS = 45000;
const DEEP_TIMEOUT_MS = 55000;

const RESEARCH_CUE_PATTERN =
  /\b(recent|recently|latest|current|currently|today|2024|2025|2026|new study|research|discovered|discovery|news|evidence|guideline|jwst|james webb|crispr|mrna|fusion|record|price|law|policy|who won|election|treaty|cite|citation|source|sources|statistics|data on|search|web|look up|find)\b/i;

// We keep research opt-in via heuristics so we don't burn quota on every question.
export function shouldRunWebResearch(question: string, mode: ResearchMode): boolean {
  if (mode === 'off') return false;
  if (mode === 'always') return true;
  // Auto mode: trigger web research for every question so the model always
  // has access to current information when available.
  return true;
}

const SYSTEM_INSTRUCTION = `You are ponder, an interactive concept-learning guide designed to help people genuinely understand how ideas work.

Pedagogical approach:
- Understand the user's real question and identify the core conceptual mechanism.
- Tailor depth cleanly to the requested level (quick, standard, or deep) while preserving a clear, calm, human voice.
- Never open with clichés like "Certainly!", "Sure!", "Here is a comprehensive breakdown", or "Let's dive in".
- Answer directly in shortAnswer (1 to 3 crisp sentences).
- Use LaTeX for mathematical expressions: inline math in $...$ and display math in $$...$$. Render clean, well-typeset mathematics.
- Organize sections cleanly (intuitive explanation -> deeper mechanism -> concrete example -> nuance or misconception).
- Explain technical terms in plain English, distinguish established science from open questions, and never fabricate statistics, quotes, or citations.
- When provided grounded web research findings, synthesize them accurately and note any uncertainty if evidence conflicts.

Structured fields:
- keyTakeaway: 1 crisp synthesis sentence.
- keyTakeaways: 2-3 memorable bullet points summarizing the core principles.
- glossary: 2-5 key terms from the explanation with brief clear definitions.
- understandingChecks: 1-2 short multiple-choice check questions grounded directly in the explanation (with 2-4 options, 0-based correctIndex, and brief clear feedback in explanation).

Interactive visualisation engine (visualisationJson):
Set visualisationJson to null ONLY if the user explicitly asks for text-only or the topic genuinely cannot be visualised. You may also provide a generated SVG illustration in the media field as a data URI (kind: generated_illustration) when a diagram would help, using a clean, accessible SVG with viewBox and readable labels. When web research or image lookup fails, always provide a generated SVG illustration as a backup so the answer remains visually rich. Ponder performs web research and sourced image lookup on your behalf; never claim you cannot browse the web or fetch images. Otherwise you MUST include an interactive visualisation from the engine. Do not default to text-only answers.

Generative UI components (when the question benefits from an interactive experience):
You may include a "generativeSpec" field as a JSON string containing a flat spec with components: Card, Button, Text, Quiz, Slider, Flashcard, Progress, CodeBlock.
Use these only when they genuinely improve learning. Keep specs small and valid. Do not include a visualisation unless it genuinely clarifies the answer. Never default to the Moon phases simulation.
Otherwise set visualisationJson to a valid JSON string matching ONE of these schemas:
1. concept_simulation:
   {"type":"concept_simulation","mode":"moon_phases","title":"...","description":"...","defaultAngle":135}
   OR mode "gravity_orbit" OR "wave_interference"
   OR mode "parametric_system" with "parameters":[{id, label, min, max, step, defaultValue, unit}] and "outputs":[{id, label, expression, unit}].
2. interactive_graph:
   {"type":"interactive_graph","title":"...","description":"...","xLabel":"x","yLabel":"f(x)","xMin":-4,"xMax":4,"yMin":-2,"yMax":10,"series":[{"id":"s1","label":"f(x) = a*x^2","expression":"a * x^2","colorRole":"accent"}],"parameters":[{"id":"a","label":"Steepness (a)","min":0.25,"max":2,"step":0.25,"defaultValue":1,"unit":""}],"showTangentAtX":true,"defaultTangentX":1}
3. experiment_slider:
   {"type":"experiment_slider","title":"...","description":"...","parameters":[...],"outputs":[{"id":"i","label":"Current","expression":"v / r","unit":"A","precision":2}],"insightRules":[{"outputId":"i","above":2,"message":"..."}]}
4. step_explorer:
   {"type":"step_explorer","title":"...","description":"...","steps":[{"title":"...","operation":"...","explanation":"...","state":[{"label":"...","value":"...","highlight":true}]}]}
5. timeline:
   {"type":"timeline","title":"...","description":"...","events":[{"date":"1687","title":"...","summary":"...","significance":"..."}]}
6. comparison:
   {"type":"comparison","title":"...","description":"...","items":["A","B"],"rows":[{"dimension":"...","values":["...","..."]}]}
7. labelled_diagram:
   {"type":"labelled_diagram","title":"...","description":"...","width":640,"height":360,"elements":[{"kind":"rect","x":120,"y":90,"width":140,"height":80,"fill":"accent-subtle","stroke":"accent","label":"Input"}],"hotspots":[{"id":"h1","label":"Input","x":190,"y":130,"description":"...","metric":"..."}]}
8. calculator:
   {"type":"calculator","title":"...","description":"...","formulaDisplay":"...","inputs":[...],"outputs":[...],"presets":[{"label":"Sample","values":{"m":5}}]}

Verify min < max, step > 0, and expressions only reference declared ids (plus "x" for graphs) using +, -, *, /, ^, sin, cos, tan, sqrt, abs, ln, log, exp, pi, e.`;

const EXPLANATION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    shortAnswer: { type: Type.STRING },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          content: { type: Type.STRING },
        },
        required: ['heading', 'content'],
      },
    },
    keyTakeaway: { type: Type.STRING },
    keyTakeaways: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    glossary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          definition: { type: Type.STRING },
        },
        required: ['term', 'definition'],
      },
    },
    understandingChecks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
        },
        required: ['question', 'options', 'correctIndex', 'explanation'],
      },
    },
    visualisationJson: {
      type: Type.STRING,
      nullable: true,
    },
    suggestedFollowUps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  propertyOrdering: [
    'title',
    'shortAnswer',
    'sections',
    'keyTakeaway',
    'keyTakeaways',
    'glossary',
    'understandingChecks',
    'visualisationJson',
    'suggestedFollowUps',
  ],
  required: ['title', 'shortAnswer', 'sections', 'keyTakeaway', 'suggestedFollowUps'],
};

function parseVisualisationField(raw: Record<string, unknown>): unknown {
  if (raw.visualisation && typeof raw.visualisation === 'object') {
    return raw.visualisation;
  }
  const vj = raw.visualisationJson;
  if (vj === null || vj === undefined) return null;
  if (typeof vj === 'object') return vj;
  if (typeof vj === 'string') {
    const cleaned = vj.trim();
    if (!cleaned || cleaned === 'null') return null;
    try {
      const unfenced = cleaned
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      return JSON.parse(unfenced);
    } catch {
      return null;
    }
  }
  return null;
}

function extractPartialFields(jsonPrefix: string): {
  title?: string;
  shortAnswer?: string;
  sections?: { heading: string; content: string }[];
} {
  const result: {
    title?: string;
    shortAnswer?: string;
    sections?: { heading: string; content: string }[];
  } = {};

  const readJsonStringAt = (key: string): string | undefined => {
    const keyPattern = new RegExp(`"${key}"\\s*:\\s*"`);
    const match = keyPattern.exec(jsonPrefix);
    if (!match) return undefined;
    let idx = match.index + match[0].length;
    let out = '';
    while (idx < jsonPrefix.length) {
      const ch = jsonPrefix[idx];
      if (ch === '\\') {
        if (idx + 1 >= jsonPrefix.length) break;
        const next = jsonPrefix[idx + 1];
        if (next === 'n') out += '\n';
        else if (next === 't') out += '\t';
        else if (next === '"' || next === '\\' || next === '/') out += next;
        else if (next === 'u') {
          if (idx + 5 >= jsonPrefix.length) break;
          const hex = jsonPrefix.slice(idx + 2, idx + 6);
          const code = Number.parseInt(hex, 16);
          if (!Number.isNaN(code)) out += String.fromCharCode(code);
          idx += 4;
        }
        idx += 2;
        continue;
      }
      if (ch === '"') break;
      out += ch;
      idx++;
    }
    return out;
  };

  const title = readJsonStringAt('title');
  if (title) result.title = title;

  const shortAnswer = readJsonStringAt('shortAnswer');
  if (shortAnswer) result.shortAnswer = shortAnswer;

  const secMatch = /"sections"\s*:\s*\[/.exec(jsonPrefix);
  if (secMatch) {
    const secSlice = jsonPrefix.slice(secMatch.index + secMatch[0].length);
    const sections: { heading: string; content: string }[] = [];
    const headingRegex = /"heading"\s*:\s*"/g;
    let hMatch: RegExpExecArray | null;
    while ((hMatch = headingRegex.exec(secSlice)) !== null) {
      const afterH = secSlice.slice(hMatch.index);
      if (afterH.startsWith('"keyTakeaway"') || afterH.startsWith('"visualisationJson"')) {
        break;
      }
      const readFrom = (sub: string, k: string): string | undefined => {
        const m = new RegExp(`"${k}"\\s*:\\s*"`).exec(sub);
        if (!m) return undefined;
        let i = m.index + m[0].length;
        let out = '';
        while (i < sub.length) {
          const ch = sub[i];
          if (ch === '\\') {
            if (i + 1 >= sub.length) break;
            const nxt = sub[i + 1];
            if (nxt === 'n') out += '\n';
            else if (nxt === '"' || nxt === '\\' || nxt === '/') out += nxt;
            i += 2;
            continue;
          }
          if (ch === '"') break;
          out += ch;
          i++;
        }
        return out;
      };
      const heading = readFrom(afterH, 'heading');
      const content = readFrom(afterH, 'content') ?? '';
      if (heading) {
        sections.push({ heading, content });
      }
    }
    if (sections.length > 0) {
      result.sections = sections;
    }
  }

  return result;
}

export function classifyGeminiError(
  err: unknown,
  opts?: { timedOut?: boolean; clientAborted?: boolean }
): StructuredGeminiError {
  if (opts?.clientAborted) {
    return {
      category: 'CLIENT_ABORTED',
      message: 'Generation was cancelled.',
      statusCode: 499,
      retryable: false,
    };
  }
  if (opts?.timedOut) {
    return {
      category: 'TIMEOUT',
      message: 'The model timed out before completing the explanation. Please try again.',
      statusCode: 504,
      retryable: true,
    };
  }

  const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
  const httpStatus =
    typeof errObj.status === 'number'
      ? errObj.status
      : typeof errObj.statusCode === 'number'
        ? errObj.statusCode
        : undefined;
  const rawMsg = err instanceof Error ? err.message : String(err);
  const lower = rawMsg.toLowerCase();

  if (lower.includes('safety') || lower.includes('blocked') || lower.includes('prohibited') || lower.includes('recitation')) {
    return {
      category: 'SAFETY_BLOCK',
      message:
        'This request triggered the model safety or content policy filters. Please rephrase your question cleanly.',
      statusCode: 422,
      retryable: false,
    };
  }

  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    lower.includes('api_key') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthenticated') ||
    lower.includes('403') ||
    lower.includes('401')
  ) {
    return {
      category: 'AUTH_ERROR',
      message:
        'Gemini API authentication failed. Verify that GEMINI_API_KEY is valid in Settings > Secrets.',
      statusCode: 403,
      retryable: false,
    };
  }

  if (httpStatus === 400 || lower.includes('invalid_argument') || lower.includes('400')) {
    const isTooLarge = lower.includes('token') || lower.includes('length') || lower.includes('too large');
    return {
      category: 'INVALID_REQUEST',
      message: isTooLarge
        ? 'This request is too large for the current context limit. Try narrowing the question.'
        : 'The model rejected this request because its configuration was invalid.',
      statusCode: 400,
      retryable: false,
    };
  }

  if (httpStatus === 404 || lower.includes('not_found') || lower.includes('404')) {
    return {
      category: 'MODEL_NOT_FOUND',
      message: 'The configured Gemini model could not be found on this API endpoint.',
      statusCode: 404,
      retryable: false,
    };
  }

  if (httpStatus === 429 || lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    const isDailyOrBilling =
      lower.includes('per_day') ||
      lower.includes('daily') ||
      lower.includes('rpd') ||
      lower.includes('free_tier') ||
      lower.includes('billing') ||
      lower.includes('spending');

    if (isDailyOrBilling) {
      return {
        category: 'QUOTA_EXHAUSTED',
        message:
          'quota exhausted, try again later.',
        statusCode: 429,
        retryable: false,
      };
    }

    return {
      category: 'RATE_LIMITED',
      message:
        'This model has reached its current requests-per-minute limit. Wait a brief moment and try again.',
      statusCode: 429,
      retryable: true,
    };
  }

  if (
    httpStatus === 503 ||
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded')
  ) {
    return {
      category: 'MODEL_UNAVAILABLE',
      message:
        'ponder is having trouble reaching the model right now because the service is temporarily overloaded.',
      statusCode: 503,
      retryable: true,
    };
  }

  if (httpStatus === 504 || lower.includes('deadline_exceeded') || lower.includes('timeout')) {
    return {
      category: 'TIMEOUT',
      message: 'The AI service took too long to respond. Please try again.',
      statusCode: 504,
      retryable: true,
    };
  }

  return {
    category: 'INTERNAL_ERROR',
    message: 'Could not complete the explanation right now. Please try again.',
    statusCode: 502,
    retryable: true,
  };
}

function extractRetryAfterMs(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const text = err instanceof Error ? err.message : JSON.stringify(err);
  const match = /retry(?:_delay| in|after)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*s/i.exec(text);
  if (!match) return null;
  const secs = Number(match[1]);
  if (!Number.isFinite(secs) || secs <= 0) return null;
  return Math.min(4500, Math.round(secs * 1000));
}

function jitteredBackoffMs(attempt: number, hintMs: number | null): number {
  const base = hintMs ?? 700 * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 350;
  return Math.min(4500, base + jitter);
}

function hostnameFromUri(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./i, '');
  } catch {
    return 'Web source';
  }
}

async function runGroundedSearch(
  serperApiKey: string | undefined,
  question: string,
  history: FollowUpContextTurn[],
  signal: AbortSignal
): Promise<{
  summaryText: string;
  citations: Citation[];
  researchNote?: string;
}> {
  if (!serperApiKey) {
    return {
      summaryText: '',
      citations: [],
      researchNote: 'Serper is not configured; explained from core model knowledge.',
    };
  }

  const contextLine =
    history.length > 0
      ? `Context: prior topic "${history[history.length - 1].title}". Question: ${question}`
      : question;

  const searchTimeout = new AbortController();
  const timer = setTimeout(() => searchTimeout.abort(), 8000);
  const onParentAbort = () => searchTimeout.abort();
  signal.addEventListener('abort', onParentAbort, { once: true });

  try {
    const results = await searchSerper(serperApiKey, contextLine, searchTimeout.signal);
    const citations: Citation[] = results.map((r, i) => ({
      id: `src_${i + 1}`,
      title: r.title,
      url: r.link,
      publisher: hostnameFromUri(r.link),
      snippet: r.snippet,
      retrievedAt: new Date().toISOString(),
    }));
    const summaryText = results.map((r) => `${r.title}: ${r.snippet}`).join('\n').slice(0, 4500);

    if (citations.length === 0) {
      return {
        summaryText: '',
        citations: [],
        researchNote: 'Web search returned no external sources; explained using core knowledge.',
      };
    }

    return { summaryText, citations };
  } catch (err) {
    console.warn('[gemini] web research failed softly:', err instanceof Error ? err.message : String(err));
    return {
      summaryText: '',
      citations: [],
      researchNote: 'Live web search was unavailable for this turn; explained from core model knowledge.',
    };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onParentAbort);
  }
}

export async function streamExplanationFromGemini(
  question: string,
  history: FollowUpContextTurn[],
  options: {
    depth?: ExplorationDepth;
    researchMode?: ResearchMode;
    clientSignal?: AbortSignal;
    apiKey?: string;
    serperApiKey?: string;
    model?: string;
  },
  callbacks: StreamCallbacks
): Promise<void> {
  const apiKey = (options.apiKey || '').trim();
  if (!apiKey) {
    callbacks.onError({
      category: 'AUTH_ERROR',
      message: 'Gemini is not configured. Add your own Gemini API key to start learning.',
      statusCode: 401,
      retryable: false,
    });
    return;
  }

  const depth: ExplorationDepth = options.depth ?? 'standard';
  const researchMode: ResearchMode = options.researchMode ?? 'auto';
  const parentAbort = new AbortController();
  const onClientAbort = () => parentAbort.abort();
  options.clientSignal?.addEventListener('abort', onClientAbort, { once: true });

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'ponder/1.0',
      },
    },
  });

  try {
    callbacks.onStatus('Thinking', 'Analyzing question and choosing the clearest teaching approach…');

    // Start non-blocking sourced Wikimedia Commons search in parallel when useful
    const mediaPromise = (async () => {
      const wiki = await searchSourcedEducationalImage(question, parentAbort.signal).catch(() => null);
      if (wiki) return wiki;
      const serperKey = options.serperApiKey;
      if (!serperKey) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      try {
        const imgs = await searchSerperImages(serperKey, question, controller.signal);
        const best = imgs.find((i) => i.imageUrl && /^https?:\/\//i.test(i.imageUrl));
        if (!best) return null;
        return {
          kind: 'sourced_image' as const,
          url: best.imageUrl,
          sourceUrl: best.link || best.source,
          title: best.title || `image for ${question}`,
          caption: `reference image for ${question}`,
          alt: `reference image illustrating ${question}`,
          attribution: best.source || undefined,
          license: undefined,
        };
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();

    let researchSummary = '';
    let citations: Citation[] = [];
    let researchNote: string | undefined;
    let researched = false;

    if (shouldRunWebResearch(question, researchMode)) {
      researched = true;
      callbacks.onStatus('Researching', 'Searching authoritative web sources…');
      const researchResult = await runGroundedSearch(options.serperApiKey, question, history, parentAbort.signal);
      if (parentAbort.signal.aborted) {
        callbacks.onError(classifyGeminiError(new Error('Client aborted'), { clientAborted: true }));
        return;
      }
      citations = researchResult.citations;
      researchSummary = researchResult.summaryText;
      researchNote = researchResult.researchNote;
      if (citations.length > 0) {
        callbacks.onStatus(
          'Reading sources',
          `Reviewing ${citations.length} grounded web ${citations.length === 1 ? 'source' : 'sources'}…`
        );
      }
    }

    const boundedHistory = history.slice(-4);
    const depthGuidance =
      depth === 'quick'
        ? 'Target depth: QUICK , crisp direct answer, 2 concise sections, 1-2 key takeaways, 1 quick understanding check.'
        : depth === 'deep'
          ? 'Target depth: DEEP DIVE , thorough explanation, 3-5 detailed sections including deeper mechanism & approximations/edge cases, 3 key takeaways, 4-6 glossary terms, and 2 thoughtful understanding checks.'
          : 'Target depth: STANDARD , clear direct answer, 2-4 well-paced sections (intuition, mechanism, concrete example), 2-3 key takeaways, 2-4 glossary terms, and 1-2 understanding checks.';

    const parts: string[] = [depthGuidance];
    if (boundedHistory.length > 0) {
      parts.push(
        `Conversation history:\n${boundedHistory
          .map(
            (h, idx) =>
              `Turn ${idx + 1}: Asked "${h.question}". Answered "${h.title}": ${h.shortAnswer}${
                h.visualisationType ? ` (Visualisation: ${h.visualisationType})` : ''
              }`
          )
          .join('\n')}`
      );
    }
    if (researchSummary) {
      parts.push(
        `Grounded web research notes (prefer these verified facts and preserve nuance; do not invent extra URLs):\n${researchSummary}`
      );
    }
    parts.push(`Current question: ${question}`);
    const promptContents = parts.join('\n\n');

    callbacks.onStatus('Synthesizing', 'Writing explanation and preparing interactive exploration…');

    const timeoutMs = depth === 'deep' ? DEEP_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
    const thinkingLevel = depth === 'deep' ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW;

    const requestedModel = options.model && Object.prototype.hasOwnProperty.call(MODEL_REGISTRY, options.model) ? options.model : PRIMARY_MODEL_ID;
    const candidateModels: { modelId: string; isFallback: boolean }[] = [
      { modelId: requestedModel, isFallback: false },
      { modelId: FALLBACK_MODEL_ID, isFallback: true },
    ];

    let lastStructuredErr: StructuredGeminiError | null = null;
    let fallbackReason: string | undefined;

    for (const candidate of candidateModels) {
      const maxAttempts = candidate.isFallback ? 1 : 2;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (options.clientSignal?.aborted) {
          callbacks.onError(classifyGeminiError(new Error('Aborted'), { clientAborted: true }));
          return;
        }

        const attemptTimeout = new AbortController();
        const timer = setTimeout(() => attemptTimeout.abort(), timeoutMs);
        const onOuterAbort = () => attemptTimeout.abort();
        parentAbort.signal.addEventListener('abort', onOuterAbort, { once: true });

        try {
          if (candidate.isFallback) {
            callbacks.onStatus(
              'Synthesizing',
              `Primary model overloaded , switching to ${MODEL_REGISTRY[FALLBACK_MODEL_ID].label}…`
            );
          }

          const stream = await ai.models.generateContentStream({
            model: candidate.modelId,
            contents: promptContents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              responseSchema: EXPLANATION_RESPONSE_SCHEMA,
              thinkingConfig: { thinkingLevel },
              abortSignal: attemptTimeout.signal,
            },
          });

          let fullText = '';
          let lastPartialSignature = '';
          let blockReason: string | undefined;

          for await (const chunk of stream) {
            if (options.clientSignal?.aborted) {
              throw new Error('__CLIENT_ABORTED__');
            }
            const candidateBlock = chunk.candidates?.[0]?.finishReason;
            if (
              candidateBlock === 'SAFETY' ||
              candidateBlock === 'RECITATION' ||
              candidateBlock === 'PROHIBITED_CONTENT'
            ) {
              blockReason = candidateBlock;
            }
            const chunkText = chunk.text ?? '';
            if (!chunkText) continue;
            fullText += chunkText;

            const partial = extractPartialFields(fullText);
            const sig = `${partial.title ?? ''}|${partial.shortAnswer ?? ''}|${
              partial.sections?.map((s) => s.heading + s.content.length).join(',') ?? ''
            }`;
            if (sig !== lastPartialSignature && (partial.title || partial.shortAnswer)) {
              lastPartialSignature = sig;
              callbacks.onPartial(partial);
            }
          }

          clearTimeout(timer);
          parentAbort.signal.removeEventListener('abort', onOuterAbort);

          if (blockReason && !fullText.trim()) {
            throw new Error(`Safety block (${blockReason})`);
          }

          const trimmed = fullText.trim();
          if (!trimmed) {
            throw new Error('Empty response from Gemini stream');
          }

          let parsedRaw: Record<string, unknown>;
          try {
            parsedRaw = JSON.parse(trimmed) as Record<string, unknown>;
          } catch {
            // Structured parse fallback: attempt non-streaming generateContent once if stream truncated JSON
            const repairRes = await ai.models.generateContent({
              model: candidate.modelId,
              contents: promptContents,
              config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
                responseSchema: EXPLANATION_RESPONSE_SCHEMA,
                thinkingConfig: { thinkingLevel },
                abortSignal: parentAbort.signal,
              },
            });
            parsedRaw = JSON.parse((repairRes.text ?? '').trim()) as Record<string, unknown>;
          }

          const parsedVis = parseVisualisationField(parsedRaw);
          const media = await mediaPromise;

          const validated = validateExplanationPayload(
            {
              ...parsedRaw,
              visualisation: parsedVis,
              depth,
              citations: citations.length > 0 ? citations : undefined,
              media: media ?? null,
              generationMeta: {
                model: candidate.modelId,
                fallbackUsed: candidate.isFallback,
                notice: candidate.isFallback ? fallbackReason : undefined,
                researched,
                researchNote,
                generatedAt: new Date().toISOString(),
              },
            },
            question
          );

          callbacks.onStatus('Complete', 'Explanation ready');
          callbacks.onComplete(validated);
          return;
        } catch (err) {
          clearTimeout(timer);
          parentAbort.signal.removeEventListener('abort', onOuterAbort);

          const clientAborted =
            Boolean(options.clientSignal?.aborted) ||
            (err instanceof Error && err.message === '__CLIENT_ABORTED__');
          const timedOut = !clientAborted && attemptTimeout.signal.aborted;
          const classified = classifyGeminiError(err, { timedOut, clientAborted });
          lastStructuredErr = classified;

          console.error(
            `[gemini] model=${candidate.modelId} attempt=${attempt} category=${classified.category} status=${classified.statusCode}`
          );

          if (classified.category === 'CLIENT_ABORTED') {
            callbacks.onError(classified);
            return;
          }

          // Never retry non-retryable errors (daily quota exhaustion, invalid args, auth, safety block, 404)
          if (!classified.retryable) {
            callbacks.onError(classified);
            return;
          }

          if (attempt < maxAttempts) {
            const delay = jitteredBackoffMs(attempt, extractRetryAfterMs(err));
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          // Allow explicit, transparent fallback to Flash-Lite only on transient overload / rate limit / timeout
          if (
            !candidate.isFallback &&
            (classified.category === 'MODEL_UNAVAILABLE' ||
              classified.category === 'RATE_LIMITED' ||
              classified.category === 'TIMEOUT')
          ) {
            fallbackReason = `Generated with ${MODEL_REGISTRY[FALLBACK_MODEL_ID].label} because ${MODEL_REGISTRY[PRIMARY_MODEL_ID].label} was temporarily unavailable (${classified.category}).`;
            break; // try fallback model
          }

          callbacks.onError(classified);
          return;
        }
      }
    }

    callbacks.onError(
      lastStructuredErr ?? {
        category: 'INTERNAL_ERROR',
        message: 'Could not generate an explanation right now. Please try again.',
        statusCode: 502,
        retryable: true,
      }
    );
  } finally {
    options.clientSignal?.removeEventListener('abort', onClientAbort);
  }
}
