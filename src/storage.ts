import { emptyState } from './domain.ts';
import type { DeskState } from './domain.ts';
import { parseBackup, stringifyBackup } from './transfer.ts';

export const COMMUNITY_DB_NAME = 'material-writing-desk-community-v1';
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'state';

function detail(error: unknown): string {
  return error instanceof Error ? error.message : '浏览器没有提供详细原因';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('此浏览器无法使用本地数据库。请使用支持 IndexedDB 的浏览器；已有数据不会被覆盖。'));
      return;
    }
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(COMMUNITY_DB_NAME, 1); }
    catch (error) { reject(new Error(`无法打开社区版本地数据库：${detail(error)}`)); return; }
    let failed = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onerror = () => reject(new Error(`无法打开社区版本地数据库：${detail(request.error)}`));
    request.onblocked = () => {
      failed = true;
      reject(new Error('社区版本地数据库被其他页面占用。请关闭其他社区版页面后重试；已有数据不会被覆盖。'));
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      if (failed) database.close();
      else resolve(database);
    };
  });
}

function snapshotTransaction(database: IDBDatabase, mode: IDBTransactionMode, snapshot?: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try { transaction = database.transaction(STORE_NAME, mode); }
    catch (error) {
      database.close();
      reject(new Error(`无法开始本地${mode === 'readonly' ? '读取' : '保存'}：${detail(error)}`));
      return;
    }
    let result: unknown;
    let failure: unknown;
    transaction.onerror = () => { failure = transaction.error || failure; };
    transaction.onabort = () => {
      database.close();
      reject(new Error(`本地${mode === 'readonly' ? '读取' : '保存'}失败：${detail(transaction.error || failure)}。上一次成功保存的数据仍保留，请导出当前内容后重试。`));
    };
    // An individual put request succeeding is not a durable save. Wait for commit.
    transaction.oncomplete = () => { database.close(); resolve(result); };
    try {
      const store = transaction.objectStore(STORE_NAME);
      const request = mode === 'readonly' ? store.get(SNAPSHOT_KEY) : store.put(snapshot, SNAPSHOT_KEY);
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => { failure = request.error; };
    } catch (error) {
      failure = error;
      try { transaction.abort(); }
      catch { database.close(); reject(new Error(`本地操作失败：${detail(error)}。上一次成功保存的数据仍保留。`)); }
    }
  });
}

export async function loadState(): Promise<DeskState> {
  const database = await openDatabase();
  const value = await snapshotTransaction(database, 'readonly');
  if (value === undefined) return emptyState();
  if (typeof value !== 'string') throw new Error('本地数据格式异常，已保留原始数据。请勿清除浏览器数据，并尝试导入已有备份。');
  try { return parseBackup(value); }
  catch (error) { throw new Error(`本地数据未通过校验，原始数据已保留：${detail(error)}`); }
}

export async function saveState(state: DeskState): Promise<void> {
  // Validate and serialize before opening a write transaction; invalid input cannot erase a snapshot.
  const snapshot = stringifyBackup(state);
  const database = await openDatabase();
  await snapshotTransaction(database, 'readwrite', snapshot);
}
