// Оффлайн-кэш для сообщений, чатов, профилей и очереди отправки.
// Использует IndexedDB — большая ёмкость, структурированные запросы.
// Файлы не кэшируем, только текст и метаданные.

const DB_NAME = 'sigmas_cache';
const DB_VERSION = 1;

const STORE_MESSAGES = 'messages';
const STORE_CONVERSATIONS = 'conversations';
const STORE_PROFILES = 'profiles';
const STORE_QUEUE = 'outbox';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const s = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        s.createIndex('conversation_id', 'conversation_id', { unique: false });
        s.createIndex('created_at', 'created_at', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PROFILES)) {
        db.createObjectStore(STORE_PROFILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const q = db.createObjectStore(STORE_QUEUE, { keyPath: 'tempId' });
        q.createIndex('conversation_id', 'conversation_id', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// ==================== MESSAGES ====================

export async function cacheMessages(messages: any[]): Promise<void> {
  if (!messages?.length) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    for (const m of messages) {
      if (m?.id && !String(m.id).startsWith('temp_')) store.put(m);
    }
  } catch (e) { console.error('cacheMessages:', e); }
}

export async function getCachedMessages(convId: string): Promise<any[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MESSAGES, 'readonly');
      const idx = tx.objectStore(STORE_MESSAGES).index('conversation_id');
      const req = idx.getAll(convId);
      req.onsuccess = () => {
        const msgs = (req.result || []).sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        resolve(msgs);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) { console.error('getCachedMessages:', e); return []; }
}

// ==================== CONVERSATIONS ====================

export async function cacheConversations(convs: any[]): Promise<void> {
  if (!convs?.length) {
    // Если список пуст — полностью очищаем кеш
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite');
      tx.objectStore(STORE_CONVERSATIONS).clear();
    } catch (e) { console.error('cacheConversations clear:', e); }
    return;
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite');
    const store = tx.objectStore(STORE_CONVERSATIONS);
    // Сначала получаем все существующие ID
    const existingReq = store.getAllKeys();
    existingReq.onsuccess = () => {
      const existingIds = new Set(existingReq.result as string[]);
      const newIds = new Set(convs.map(c => c?.id).filter(Boolean));
      // Удаляем те, которых больше нет на сервере
      for (const id of existingIds) {
        if (!newIds.has(id)) store.delete(id);
      }
      // Обновляем существующие
      for (const c of convs) {
        if (c?.id) store.put(c);
      }
    };
  } catch (e) { console.error('cacheConversations:', e); }
}

export async function getCachedConversations(): Promise<any[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONVERSATIONS, 'readonly');
      const req = tx.objectStore(STORE_CONVERSATIONS).getAll();
      req.onsuccess = () => {
        const list = (req.result || []).sort((a, b) =>
          new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
        );
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) { console.error('getCachedConversations:', e); return []; }
}

// ==================== PROFILES ====================

export async function cacheProfiles(profiles: any[]): Promise<void> {
  if (!profiles?.length) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PROFILES, 'readwrite');
    const store = tx.objectStore(STORE_PROFILES);
    for (const p of profiles) {
      if (p?.id) store.put(p);
    }
  } catch (e) { console.error('cacheProfiles:', e); }
}

export async function getCachedProfile(userId: string): Promise<any | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROFILES, 'readonly');
      const req = tx.objectStore(STORE_PROFILES).get(userId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}

// ==================== OUTBOX (очередь отправки) ====================

export interface QueuedMessage {
  tempId: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: 'text';
  reply_to_id?: string | null;
  story_reply_snapshot?: import('@/types').StoryReplySnapshot | null;
  created_at: string;
  retries: number;
}

export async function addToQueue(msg: QueuedMessage): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).put(msg);
  } catch (e) { console.error('addToQueue:', e); }
}

export async function getQueuedMessages(): Promise<QueuedMessage[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => resolve((req.result || []) as QueuedMessage[]);
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}

export async function removeFromQueue(tempId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).delete(tempId);
  } catch (e) { console.error('removeFromQueue:', e); }
}

export async function incrementQueueRetry(tempId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    const req = store.get(tempId);
    req.onsuccess = () => {
      if (req.result) {
        req.result.retries = (req.result.retries || 0) + 1;
        store.put(req.result);
      }
    };
  } catch {}
}

// ==================== CLEAR ====================

export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    for (const name of [STORE_MESSAGES, STORE_CONVERSATIONS, STORE_PROFILES, STORE_QUEUE]) {
      const tx = db.transaction(name, 'readwrite');
      tx.objectStore(name).clear();
    }
  } catch (e) { console.error('clearCache:', e); }
}
