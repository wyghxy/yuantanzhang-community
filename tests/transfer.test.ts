import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDocument, emptyState } from '../src/domain.ts';
import type { DeskState, Material, RichNode } from '../src/domain.ts';
import { createMaterialFromText, mergeBackup, parseBackup, richTextToMarkdown, richTextToPlain, safeSourceUrl, stringifyBackup } from '../src/transfer.ts';

const time = '2026-10-24T08:00:00.000Z';
function material(id = 'material-1'): Material {
  return { id, title: '保留标题 🧭', body: '第一行\r\n  缩进，e\u0301 和 é\n中文🙂\n<script>只作文本</script>\n', sourceUrl: 'https://example.org/source?a=1', platform: '手动', tags: ['研究', '原文'], createdAt: time, updatedAt: time };
}
function fixture(): DeskState {
  return {
    version: 1,
    materials: [material()],
    drafts: [{ id: 'draft-1', title: '本地手写稿', materialId: 'material-1', content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '写作 📝', marks: [{ type: 'bold' }] }] }, { type: 'paragraph', content: [{ type: 'text', text: '  e\u0301 与中文 <img src=x>  ', marks: [{ type: 'textStyle', attrs: { color: '#3b82f6' } }, { type: 'highlight', attrs: { color: 'yellow' } }] }] }] }, createdAt: time, updatedAt: time }],
    notes: [{ id: 'note-1', materialId: 'material-1', quote: '第一行\r\n', thought: '本地笔记 💭', createdAt: time }],
  };
}
function rejectMutation(mutate: (value: DeskState) => void, expected: RegExp = /备份格式不正确/): void {
  const state = fixture();
  mutate(state);
  assert.throws(() => parseBackup(JSON.stringify(state)), expected);
}

test('JSON round trip preserves original body, Unicode, whitespace, draft marks and note references', () => {
  const original = fixture();
  assert.deepEqual(parseBackup(stringifyBackup(original)), original);
  assert.equal(original.materials[0].body, parseBackup(stringifyBackup(original)).materials[0].body);
  assert.deepEqual(parseBackup(stringifyBackup(emptyState())), emptyState());
});

test('source links accept only HTTP(S), remove credentials, and permit an empty source', () => {
  assert.equal(safeSourceUrl('https://person:secret@example.org/a?x=1#part'), 'https://example.org/a?x=1#part');
  assert.equal(safeSourceUrl('  '), '');
  for (const url of ['javascript:alert(1)', 'data:text/html,<h1>x</h1>', 'file:///c:/data', '//example.org', 'http://exa mple.org', 'https:\n//example.org']) assert.throws(() => safeSourceUrl(url));
});

test('text import is local data only and retains all body bytes and Unicode', () => {
  const body = '\uFEFF  文本🙂\r\n原稿\n\n<script>literal</script>\n';
  const result = createMaterialFromText('C:\\manual\\原稿.txt', body);
  assert.equal(result.title, '原稿');
  assert.equal(result.body, body);
  assert.equal(result.platform, '手动导入');
  assert.equal(result.sourceUrl, '');
  assert.match(result.id, /^[a-z0-9-]+$/i);
  assert.deepEqual(result.tags, []);
  assert.equal(parseBackup(stringifyBackup({ ...emptyState(), materials: [result] })).materials[0].body, body);
});

test('schema, required fields, unsupported versions and invalid dates are rejected', () => {
  assert.throws(() => parseBackup('<html>not JSON</html>'));
  assert.throws(() => parseBackup(JSON.stringify({ ...emptyState(), version: 2 })));
  assert.throws(() => parseBackup(JSON.stringify({ ...emptyState(), extra: true })));
  assert.throws(() => parseBackup('{"version":1,"materials":[],"drafts":[],"notes":[],"__proto__":{"x":true}}'));
  rejectMutation((state) => { delete (state.materials[0] as Partial<Material>).body; });
  rejectMutation((state) => { state.materials[0].createdAt = '2026-02-30T08:00:00.000Z'; });
  rejectMutation((state) => { state.materials[0].updatedAt = 'yesterday'; });
  rejectMutation((state) => { state.materials[0].id = '../escape'; });
  rejectMutation((state) => { state.materials[0].tags = ['same', 'same']; });
  rejectMutation((state) => { state.materials[0].title = 'x'.repeat(301); });
});

test('quantities, UTF-8 body bytes, backup bytes and content depth have bounded limits', () => {
  rejectMutation((state) => { state.materials = Array.from({ length: 1001 }, (_, index) => material(`m-${index}`)); });
  rejectMutation((state) => { state.drafts = Array.from({ length: 1001 }, (_, index) => ({ ...state.drafts[0], id: `d-${index}` })); });
  rejectMutation((state) => { state.notes = Array.from({ length: 10001 }, (_, index) => ({ ...state.notes[0], id: `n-${index}` })); });
  rejectMutation((state) => { state.materials[0].body = '中'.repeat(700000); });
  assert.throws(() => parseBackup(' '.repeat(10 * 1024 * 1024 + 1)), /10 MiB/);
  let nested: RichNode = { type: 'paragraph' };
  for (let index = 0; index < 34; index++) nested = { type: 'blockquote', content: [nested] };
  rejectMutation((state) => { state.drafts[0].content = { type: 'doc', content: [nested] }; }, /层级/);
});

test('duplicate IDs and missing material relationships reject the entire backup', () => {
  rejectMutation((state) => { state.materials.push({ ...state.materials[0] }); }, /ID 重复/);
  rejectMutation((state) => { state.drafts[0].materialId = 'missing'; }, /关联素材不存在/);
  rejectMutation((state) => { state.notes[0].materialId = 'missing'; }, /关联素材不存在/);
  const state = fixture();
  state.drafts[0].materialId = null;
  assert.equal(parseBackup(JSON.stringify(state)).drafts[0].materialId, null);
});

test('unsafe rich-text node, mark, attribute, malformed tree and CSS values are rejected', () => {
  for (const type of ['image', 'iframe', 'html', 'script', 'video', 'link', 'rawHTML']) {
    rejectMutation((state) => { state.drafts[0].content = { type: 'doc', content: [{ type, attrs: { src: 'https://example.org' } }] }; });
  }
  const malicious: RichNode[] = [
    { type: 'paragraph', attrs: { onclick: 'alert(1)' } },
    { type: 'paragraph', content: [{ type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'CSS', marks: [{ type: 'textStyle', attrs: { color: 'url(https://evil.test)' } }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'CSS', marks: [{ type: 'highlight', attrs: { color: 'red;display:none' } }] }] },
    { type: 'paragraph', content: [{ type: 'heading', content: [{ type: 'text', text: 'invalid nesting' }] }] },
    { type: 'text', text: 'text at root' },
    { type: 'heading', attrs: { level: 9 } },
    { type: 'orderedList', attrs: { start: -1 }, content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
  ];
  for (const node of malicious) rejectMutation((state) => { state.drafts[0].content = { type: 'doc', content: [node] }; });
  const hostile = JSON.stringify(fixture()).replace('"level":2', '"level":2,"__proto__":{"polluted":true}');
  assert.throws(() => parseBackup(hostile), /不安全/);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test('merge deduplicates identical IDs and rejects conflicts without mutating either input', () => {
  const current = fixture();
  const incoming = fixture();
  incoming.materials.push(material('material-2'));
  const before = structuredClone(current);
  const added = structuredClone(incoming);
  const merged = mergeBackup(current, incoming);
  assert.equal(merged.materials.length, 2);
  assert.equal(merged.drafts.length, 1);
  assert.equal(merged.notes.length, 1);
  assert.deepEqual(current, before);
  assert.deepEqual(incoming, added);
  incoming.materials[0].body = 'same ID, different content';
  assert.throws(() => mergeBackup(current, incoming), /合并已取消.*内容不同/);
  assert.deepEqual(current, before);
  assert.deepEqual(mergeBackup(emptyState(), fixture()), fixture());
});

test('plain text and Markdown preserve writing while keeping raw HTML inert', () => {
  const content: RichNode = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '中文🙂' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '<script> & [链接](javascript:x)' }, { type: 'hardBreak' }, { type: 'text', text: '  ', marks: [{ type: 'bold' }] }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '列表' }] }] }] },
    { type: 'codeBlock', attrs: { language: 'text' }, content: [{ type: 'text', text: '  中文\n```\n' }] },
  ] };
  const plain = richTextToPlain(content);
  assert.match(plain, /中文🙂/);
  assert.match(plain, /<script>/);
  assert.match(plain, /  中文\n```\n/);
  const markdown = richTextToMarkdown(content);
  assert.match(markdown, /^## 中文🙂/);
  assert.match(markdown, /&lt;script&gt; &amp;/);
  assert.doesNotMatch(markdown, /<script>/);
  assert.match(markdown, /- 列表/);
  assert.match(markdown, /````text\n  中文\n```\n\n````/);
  assert.equal(richTextToPlain(emptyDocument()), '');
});
