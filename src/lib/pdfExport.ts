import { jsPDF } from 'jspdf';
import type { ExplorationThread, ExplorationTurn } from './schema.ts';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'ponder-exploration';
}

export function exportTurnAsPdf(turn: ExplorationTurn): void {
  const thread: ExplorationThread = {
    id: turn.id,
    title: turn.explanation.title,
    turns: [turn],
    updatedAt: turn.createdAt,
  };
  exportThreadAsPdf(thread);
}

export function exportThreadAsPdf(thread: ExplorationThread): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 52;
  const maxWidth = pageW - marginX * 2;
  let y = 58;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 54) {
      doc.addPage();
      y = 54;
    }
  };

  const writeWrapped = (
    text: string,
    fontSize: number,
    style: 'normal' | 'bold' | 'italic',
    color: [number, number, number],
    lineHeightRatio = 1.42,
    extraGap = 8
  ) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    const step = fontSize * lineHeightRatio;

    for (const line of lines) {
      ensureSpace(step + 6);
      doc.text(line, marginX, y);
      y += step;
    }
    y += extraGap;
  };

  // Header brand mark (vector logo)
  const logoX = marginX;
  const logoY = y - 2;
  doc.setFillColor(40, 40, 40);
  doc.circle(logoX + 6, logoY + 6, 3.2, 'F');
  doc.setDrawColor(70, 120, 75);
  doc.setLineWidth(1.2);
  doc.ellipse(logoX + 6, logoY + 6, 9.5, 3.8, 'S');
  doc.setFillColor(40, 40, 40);
  doc.circle(logoX + 14.2, logoY + 2.8, 1.4, 'F');
  doc.setFillColor(215, 153, 33);
  doc.circle(logoX + 14.2, logoY + 2.8, 0.7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('Ponder', marginX + 20, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(92, 83, 74);
  doc.text('concept exploration', marginX + 20, y + 11);
  y += 22;

  doc.setDrawColor(216, 207, 192);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageW - marginX, y);
  y += 12;

  writeWrapped(thread.title, 20, 'bold', [40, 40, 40], 1.25, 6);
  writeWrapped(
    `Exported ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}  ·  ${thread.turns.length} ${thread.turns.length === 1 ? 'exploration' : 'explorations'}`,
    9.5,
    'normal',
    [92, 83, 74],
    1.3,
    14
  );



  thread.turns.forEach((turn, idx) => {
    const exp = turn.explanation;
    if (idx > 0) {
      ensureSpace(48);
      doc.setDrawColor(216, 207, 192);
      doc.line(marginX, y, pageW - marginX, y);
      y += 20;
    }

    writeWrapped(
      `${idx === 0 ? 'Question' : `Follow-up ${idx}`}: "${turn.question}"`,
      10.5,
      'italic',
      [92, 83, 74],
      1.35,
      6
    );

    if (idx > 0) {
      writeWrapped(exp.title, 15, 'bold', [40, 40, 40], 1.25, 6);
    }

    writeWrapped(exp.shortAnswer, 11.5, 'normal', [40, 40, 40], 1.48, 10);

    for (const sec of exp.sections) {
      writeWrapped(sec.heading, 12.5, 'bold', [40, 40, 40], 1.3, 3);
      writeWrapped(sec.content, 10.5, 'normal', [60, 56, 54], 1.48, 8);
    }

    if (exp.visualisation) {
      ensureSpace(36);
      writeWrapped(
        `Interactive Model (${exp.visualisation.type.replace('_', ' ')}): ${exp.visualisation.title}`,
        10,
        'bold',
        [70, 120, 75],
        1.35,
        2
      );
      if (exp.visualisation.description) {
        writeWrapped(exp.visualisation.description, 9.5, 'normal', [92, 83, 74], 1.38, 8);
      }
    }

    if (exp.keyTakeaways && exp.keyTakeaways.length > 0) {
      writeWrapped('Key Takeaways', 11, 'bold', [70, 120, 75], 1.3, 4);
      exp.keyTakeaways.forEach((tk) => {
        writeWrapped(`• ${tk}`, 10.5, 'normal', [40, 40, 40], 1.4, 3);
      });
      y += 6;
    } else if (exp.keyTakeaway) {
      writeWrapped('Key Takeaway', 11, 'bold', [70, 120, 75], 1.3, 3);
      writeWrapped(exp.keyTakeaway, 10.5, 'normal', [40, 40, 40], 1.42, 10);
    }

    if (exp.glossary && exp.glossary.length > 0) {
      writeWrapped('Concept Glossary', 11, 'bold', [40, 40, 40], 1.3, 4);
      exp.glossary.forEach((item) => {
        writeWrapped(`${item.term}: ${item.definition}`, 9.8, 'normal', [60, 56, 54], 1.38, 3);
      });
      y += 6;
    }

    if (exp.citations && exp.citations.length > 0) {
      writeWrapped('Sources & References', 11, 'bold', [40, 40, 40], 1.3, 4);
      exp.citations.forEach((c, cIdx) => {
        writeWrapped(`[${cIdx + 1}] ${c.title} , ${c.url}`, 9, 'normal', [92, 83, 74], 1.35, 3);
      });
      y += 6;
    }
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(146, 131, 116);
    doc.text(`ponder  ·  Page ${i} of ${pageCount}`, marginX, pageH - 28);
  }

  doc.save(`${slugify(thread.title)}.pdf`);
}

export function exportThreadAsMarkdown(thread: ExplorationThread): string {
  const lines: string[] = [`# ${thread.title}`, ''];
  thread.turns.forEach((turn, idx) => {
    const exp = turn.explanation;
    lines.push(`## ${idx === 0 ? 'Question' : `Follow-up ${idx}`}: ${turn.question}`);
    lines.push('');
    lines.push(exp.shortAnswer);
    lines.push('');
    exp.sections.forEach((sec) => {
      lines.push(`### ${sec.heading}`);
      lines.push('');
      lines.push(sec.content);
      lines.push('');
    });
    if (exp.keyTakeaways && exp.keyTakeaways.length > 0) {
      lines.push('**Key takeaways:**');
      exp.keyTakeaways.forEach((t) => lines.push(`- ${t}`));
      lines.push('');
    } else if (exp.keyTakeaway) {
      lines.push(`**Key takeaway:** ${exp.keyTakeaway}`);
      lines.push('');
    }
    if (exp.citations && exp.citations.length > 0) {
      lines.push('**Sources:**');
      exp.citations.forEach((c) => lines.push(`- [${c.title}](${c.url})`));
      lines.push('');
    }
  });
  return lines.join('\n');
}

export function formatExplanationForCopy(turn: ExplorationTurn): string {
  const exp = turn.explanation;
  const parts: string[] = [
    exp.title,
    `Question: ${turn.question}`,
    '',
    exp.shortAnswer,
    '',
  ];
  exp.sections.forEach((s) => {
    parts.push(s.heading);
    parts.push(s.content);
    parts.push('');
  });
  if (exp.keyTakeaways && exp.keyTakeaways.length > 0) {
    parts.push('Key takeaways:');
    exp.keyTakeaways.forEach((t) => parts.push(`- ${t}`));
  } else {
    parts.push(`Key takeaway: ${exp.keyTakeaway}`);
  }
  if (exp.citations && exp.citations.length > 0) {
    parts.push('');
    parts.push('Sources:');
    exp.citations.forEach((c) => parts.push(`- ${c.title}: ${c.url}`));
  }
  return parts.join('\n').trim();
}
