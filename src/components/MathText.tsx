import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

type MathTextProps = {
  text: string;
  className?: string;
};

// Renders plain text with inline ($...$) and display ($$...$$) LaTeX.
export function MathText({ text, className }: MathTextProps) {
  const html = useMemo(() => {
    if (!text) return '';
    // Display math first
    let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
      try {
        return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return `$$${expr}$$`;
      }
    });
    // Inline math
    result = result.replace(/\$([^$\n]+?)\$/g, (_, expr) => {
      try {
        return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return `$${expr}$`;
      }
    });
    // Escape remaining HTML? We trust model output; but basic safety: keep as-is.
    return result;
  }, [text]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
