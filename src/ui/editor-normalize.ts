import type { RichNode } from '../domain.ts';

/**
 * Convert editor-generated JSON to the community document contract.
 * ProseMirror may mark the inline hardBreak when a selection spans Shift+Enter.
 * The break has no visible text styling, so keep the break and style its text only.
 * Other node types, marks and attributes remain visible to the strict validator.
 */
export function normalizeEditorDocument(input: RichNode): RichNode {
  const node: RichNode = { ...input };
  if (node.type === 'hardBreak') delete node.marks;
  else if (node.type === 'text' && node.marks) {
    node.marks = node.marks.map((mark) => {
      if (!mark.attrs) return { ...mark };
      const attrs = { ...mark.attrs };
      for (const key of ['color', 'backgroundColor']) {
        const value = attrs[key];
        if (typeof value !== 'string') continue;
        const rgb = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
        if (rgb) attrs[key] = `#${rgb.slice(1).map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, '0')).join('')}`;
        else if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) && !/^(black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|brown|cyan|magenta|navy|teal|lime|maroon|olive|silver|aqua|fuchsia|transparent)$/i.test(value)) attrs[key] = null;
      }
      return { ...mark, attrs };
    });
  }
  if (node.content) node.content = node.content.map(normalizeEditorDocument);
  return node;
}
