import type { Explanation } from './schema.ts';

export const DEFAULT_WPM = 220;

export type ReadingTimeResult = {
  wordCount: number;
  minutesExact: number;
  minutesRounded: number;
  label: string;
};

/**
 * Strips markdown formatting, fenced non-prose code blocks, HTML tags,
 * and extra punctuation so reading time reflects natural explanation prose.
 */
function sanitizeProseForCounting(raw: string): string {
  if (!raw) return '';
  return (
    raw
      // Exclude fenced code blocks that do not represent readable prose
      .replace(/```[\s\S]*?```/g, ' ')
      // Keep inline code words (e.g. mathematical terms or variables) without backticks
      .replace(/`([^`]+)`/g, '$1')
      // Replace markdown links [label](url) with just label
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Strip HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Normalize list markers and heading symbols
      .replace(/^[\s>#*\-+]+/gm, ' ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function countWords(text: string): number {
  const clean = sanitizeProseForCounting(text);
  if (!clean) return 0;
  const tokens = clean.split(/\s+/).filter((token) => /[a-zA-Z0-9\u00C0-\u024F]/.test(token));
  return tokens.length;
}

export function extractExplanationProse(explanation: Partial<Explanation> | null | undefined): string {
  if (!explanation) return '';
  const parts: string[] = [];

  if (explanation.title) parts.push(explanation.title);
  if (explanation.shortAnswer) parts.push(explanation.shortAnswer);

  if (Array.isArray(explanation.sections)) {
    for (const sec of explanation.sections) {
      if (sec.heading) parts.push(sec.heading);
      if (sec.content) parts.push(sec.content);
    }
  }

  if (Array.isArray(explanation.keyTakeaways) && explanation.keyTakeaways.length > 0) {
    parts.push(explanation.keyTakeaways.join(' '));
  } else if (explanation.keyTakeaway) {
    parts.push(explanation.keyTakeaway);
  }

  return parts.join('\n\n');
}

export function calculateReadingTime(
  explanation: Partial<Explanation> | null | undefined,
  wpm: number = DEFAULT_WPM
): ReadingTimeResult {
  const prose = extractExplanationProse(explanation);
  const wordCount = countWords(prose);

  if (wordCount === 0) {
    return {
      wordCount: 0,
      minutesExact: 0,
      minutesRounded: 0,
      label: '',
    };
  }

  const safeWpm = Math.max(80, Math.min(500, wpm));
  const minutesExact = wordCount / safeWpm;

  if (minutesExact < 0.75) {
    return {
      wordCount,
      minutesExact,
      minutesRounded: 0,
      label: 'Less than 1 min',
    };
  }

  const minutesRounded = Math.max(1, Math.round(minutesExact));
  if (minutesRounded === 1) {
    return {
      wordCount,
      minutesExact,
      minutesRounded: 1,
      label: '1 min read',
    };
  }

  return {
    wordCount,
    minutesExact,
    minutesRounded,
    label: `About ${minutesRounded} min read`,
  };
}
