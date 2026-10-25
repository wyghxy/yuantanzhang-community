import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { emptyDocument, emptyState } from '../src/domain.ts';
import type { DeskState } from '../src/domain.ts';
import { COMMUNITY_DB_NAME, loadState, saveState } from '../src/storage.ts';

function fixture(body: string): DeskState {
  const time = '2026-10-24T08:00:00.000Z';
  return { version: 1, materials: [{ id: 'm-1', title: '本地数据', body, sourceUrl: '', platform: '', tags: [], createdAt: time, updatedAt: time }], drafts: [{ id: 'd-1', title: '稿件', content: emptyDocument(), materialId: 'm-1', createdAt: time, updatedAt: time }], notes: [{ id: 'n-1', materialId: 'm-1', quote: '', thought: '保留笔记', createdAt: time }] };
}

test('IndexedDB commits one snapshot and reads back Unicode, notes and rich-text JSON', async () => {
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true });
  assert.deepEqual(await loadState(), emptyState());
  const state = fixture('第一行\r\n  中文🙂 e\u0301\n');
  await saveState(state);
  assert.deepEqual(await loadState(), state);
  const databases = await indexedDB.databases();
  assert.deepEqual(databases.map((entry) => entry.name), [COMMUNITY_DB_NAME]);
});

test('a transaction aborted after put success rejects save and retains the previous snapshot', async () => {
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true });
  const before = fixture('旧数据必须保留');
  await saveState(before);
  const originalPut = IDBObjectStore.prototype.put;
  let requestSucceeded = false;
  IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>): IDBRequest<IDBValidKey> {
    const request = originalPut.apply(this, args);
    request.addEventListener('success', () => { requestSucceeded = true; this.transaction.abort(); });
    return request;
  };
  try {
    await assert.rejects(saveState(fixture('不应提交的新数据')), /保存失败.*上一次成功保存的数据仍保留/);
    assert.equal(requestSucceeded, true, 'The failure occurred after the put request succeeded but before transaction commit.');
  } finally { IDBObjectStore.prototype.put = originalPut; }
  assert.deepEqual(await loadState(), before);
});

test('invalid state is rejected before a write and does not replace local data', async () => {
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true });
  const before = fixture('有效数据');
  await saveState(before);
  const invalid = fixture('不写入');
  invalid.notes[0].materialId = 'missing';
  await assert.rejects(saveState(invalid), /关联素材不存在/);
  assert.deepEqual(await loadState(), before);
});

test('lack of IndexedDB reports an understandable failure', async () => {
  const original = globalThis.indexedDB;
  Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
  try { await assert.rejects(loadState(), /无法使用本地数据库/); }
  finally { Object.defineProperty(globalThis, 'indexedDB', { value: original, configurable: true }); }
});
