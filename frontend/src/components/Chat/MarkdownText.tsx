/**
 * Lightweight Markdown → React renderer.
 *
 * Handles: **bold**, *italic*, `code`, ```code blocks```, # headings,
 * bullet lists (- / *), numbered lists (1.), [links](url), ---.
 *
 * XSS-safe: outputs React elements, never dangerouslySetInnerHTML.
 * No external dependencies.
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ── Inline parsing ──────────────────────────────────────────────────

/**
 * Match priority (left → right in alternation):
 *  1. **bold**
 *  2. `code`
 *  3. *italic*  (must come after bold so ** doesn't match as two *)
 *  4. [text](url)
 */
const INLINE_RE =
  /(\*\*(.+?)\*\*)|(`([^`]+?)`)|(\*([^*]+?)\*)|(\[([^\]]+)\]\(([^)]+)\))/g;

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  INLINE_RE.lastIndex = 0;

  while ((match = INLINE_RE.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2] !== undefined) {
      // **bold**
      parts.push(
        <strong key={`b${match.index}`} className="font-semibold">
          {match[2]}
        </strong>,
      );
    } else if (match[4] !== undefined) {
      // `code`
      parts.push(
        <code
          key={`c${match.index}`}
          className="px-1 py-0.5 rounded bg-foreground/10 text-[0.85em] font-mono"
        >
          {match[4]}
        </code>,
      );
    } else if (match[6] !== undefined) {
      // *italic*
      parts.push(
        <em key={`i${match.index}`}>{match[6]}</em>,
      );
    } else if (match[8] !== undefined && match[9] !== undefined) {
      // [text](url)
      parts.push(
        <a
          key={`a${match.index}`}
          href={match[9]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-1 underline-offset-2 hover:opacity-80"
        >
          {match[8]}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

// ── Block parsing ───────────────────────────────────────────────────

interface BlockNode {
  type: 'heading' | 'p' | 'ul' | 'ol' | 'code' | 'hr';
  content?: string;
  level?: number; // heading level 1–6
  items?: string[];
  lang?: string;
}

function isBlockStart(line: string): boolean {
  const trimmed = line.trimStart();
  return (
    /^#{1,6}\s/.test(trimmed) ||
    /^[-*+]\s/.test(trimmed) ||
    /^\d+[.)]\s/.test(trimmed) ||
    /^```/.test(trimmed) ||
    /^---+$/.test(trimmed.trim()) ||
    /^\*\*\*+$/.test(trimmed.trim())
  );
}

function parseBlocks(text: string): BlockNode[] {
  const lines = text.split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // ── Code block ──
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', content: codeLines.join('\n'), lang });
      i++; // skip closing ```
      continue;
    }

    // ── Heading ──
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      blocks.push({ type: 'heading', level: hMatch[1].length, content: hMatch[2] });
      i++;
      continue;
    }

    // ── Horizontal rule ──
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // ── Unordered list ──
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trimStart())) {
        items.push(lines[i].trimStart().replace(/^[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // ── Ordered list ──
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trimStart())) {
        items.push(lines[i].trimStart().replace(/^\d+[.)]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // ── Empty line ──
    if (trimmed === '') {
      i++;
      continue;
    }

    // ── Paragraph: collect consecutive plain lines ──
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !isBlockStart(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'p', content: paraLines.join('\n') });
    }
  }

  return blocks;
}

// ── Render ──────────────────────────────────────────────────────────

function renderBlock(block: BlockNode, idx: number): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const hClasses: Record<number, string> = {
        1: 'text-base font-bold mt-5 mb-2',
        2: 'text-[0.94rem] font-bold mt-4 mb-1.5',
        3: 'text-sm font-semibold mt-3.5 mb-1.5',
        4: 'text-sm font-semibold mt-3 mb-1',
        5: 'text-sm font-medium mt-2.5 mb-1',
        6: 'text-sm font-medium mt-2.5 mb-1',
      };
      return (
        <p key={idx} className={cn(hClasses[block.level ?? 3], idx === 0 && 'mt-0')}>
          {parseInline(block.content ?? '')}
        </p>
      );
    }

    case 'p':
      return (
        <p key={idx} className="whitespace-pre-wrap mb-3 last:mb-0 leading-[1.7]">
          {parseInline(block.content ?? '')}
        </p>
      );

    case 'ul':
      return (
        <ul key={idx} className="list-disc list-inside space-y-1.5 mb-3 pl-1">
          {block.items?.map((item, i) => (
            <li key={i} className="leading-[1.7]">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol key={idx} className="list-decimal list-inside space-y-1.5 mb-3 pl-1">
          {block.items?.map((item, i) => (
            <li key={i} className="leading-[1.7]">
              {parseInline(item)}
            </li>
          ))}
        </ol>
      );

    case 'code':
      return (
        <pre
          key={idx}
          className="rounded-md bg-foreground/10 px-3 py-2.5 my-3 overflow-x-auto text-[0.8em] font-mono leading-relaxed"
        >
          <code>{block.content}</code>
        </pre>
      );

    case 'hr':
      return <hr key={idx} className="border-current/20 my-4" />;

    default:
      return null;
  }
}

// ── Public component ────────────────────────────────────────────────

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
  // Fast path: if there's no markdown syntax at all, render plain
  if (!/[*`#\-\[_]/.test(content)) {
    return (
      <p className={cn('whitespace-pre-wrap leading-[1.7]', className)}>
        {content}
      </p>
    );
  }

  const blocks = parseBlocks(content);

  return (
    <div className={className}>
      {blocks.map((block, idx) => renderBlock(block, idx))}
    </div>
  );
}
