import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { emptyState } from '../src/domain.ts';
import type { DeskState, RichNode } from '../src/domain.ts';
import { loadState, saveState } from '../src/storage.ts';
import { parseBackup, richTextToMarkdown, richTextToPlain, stringifyBackup } from '../src/transfer.ts';
import { normalizeEditorDocument } from '../src/ui/editor-normalize.ts';

const time = '2026-10-24T08:00:00.000Z';
function snapshot(content: RichNode): DeskState {
  return { ...emptyState(), drafts: [{ id: 'marked-line-break', title: '换行样式回归', content, materialId: null, createdAt: time, updatedAt: time }] };
}
const formats: { name: string; mark: NonNullable<RichNode['marks']>[number]; markdown: string }[] = [
  { name: 'bold', mark: { type: 'bold' }, markdown: '**A**  \n**B**' },
  { name: 'highlight', mark: { type: 'highlight', attrs: { color: '#fff2a8' } }, markdown: 'A  \nB' },
  { name: 'textStyle', mark: { type: 'textStyle', attrs: { color: '#2463eb' } }, markdown: 'A  \nB' },
];

for (const { name, mark, markdown } of formats) {
  test(`Shift+Enter marked ${name} normalizes and survives IndexedDB, JSON and Markdown`, async () => {
    // Exact JSON shape produced when ProseMirror marks a selection spanning A, a hard break, B.
    const editorJson: RichNode = { type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'A', marks: [mark] },
      { type: 'hardBreak', marks: [mark] },
      { type: 'text', text: 'B', marks: [mark] },
    ] }] };
    const original = structuredClone(editorJson);
    assert.throws(() => stringifyBackup(snapshot(editorJson)), /只有非代码块的文本可以使用文本样式/);
    const normalized = normalizeEditorDocument(editorJson);
    assert.deepEqual(editorJson, original, 'normalization must not mutate editor JSON');
    const children = normalized.content![0].content!;
    assert.deepEqual(children[1], { type: 'hardBreak' });
    assert.deepEqual(children[0].marks, [mark]);
    assert.deepEqual(children[2].marks, [mark]);
    const state = snapshot(normalized);
    assert.deepEqual(parseBackup(stringifyBackup(state)), state);
    await saveState(state);
    const loaded = await loadState();
    assert.deepEqual(loaded, state);
    assert.equal(richTextToPlain(loaded.drafts[0].content), 'A\nB');
    assert.equal(richTextToMarkdown(loaded.drafts[0].content), markdown);
  });
}

test('editor RGB conversion keeps text styles and normalizer leaves unsupported tree shapes rejectable', () => {
  const content: RichNode = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '颜色', marks: [{ type: 'textStyle', attrs: { color: 'rgb(36, 99, 235)' } }] }] }] };
  assert.equal(normalizeEditorDocument(content).content![0].content![0].marks![0].attrs!.color, '#2463eb');
  const invalidNodes: RichNode[] = [
    { type: 'paragraph', marks: [{ type: 'bold' }] },
    { type: 'paragraph', attrs: { unexpected: 'value' } },
    { type: 'paragraph', content: [{ type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://example.org/' } }] }] },
    { type: 'html', attrs: { html: '<script>bad()</script>' } },
    { type: 'hardBreak', attrs: { unexpected: 'value' } },
  ];
  for (const node of invalidNodes) {
    const invalid: RichNode = node.type === 'hardBreak' ? { type: 'doc', content: [{ type: 'paragraph', content: [node] }] } : { type: 'doc', content: [node] };
    assert.throws(() => stringifyBackup(snapshot(normalizeEditorDocument(invalid))), /备份格式不正确/);
  }
});
