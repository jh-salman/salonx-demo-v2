/**
 * Persists large client profile images (data URLs) in IndexedDB so
 * `@salonx/consultations/v1` stays under localStorage quota.
 */

const DB_NAME = 'salonx-client-avatars/v1';
const DB_VERSION = 1;
const STORE = 'blobs';

export const CLIENT_AVATAR_DB_UPDATED = 'salonx:client-avatar-db-updated';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dispatchUpdated(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(CLIENT_AVATAR_DB_UPDATED, { detail: detail || {} }),
  );
}

export async function putClientAvatar(clientKey, dataUrl) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(dataUrl, clientKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  dispatchUpdated({ clientKey });
}

export async function getClientAvatar(clientKey) {
  if (!clientKey) return null;
  try {
    const db = await openDb();
    const v = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const q = tx.objectStore(STORE).get(clientKey);
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    db.close();
    return typeof v === 'string' && v ? v : null;
  } catch {
    return null;
  }
}

export async function deleteClientAvatar(clientKey) {
  if (!clientKey) return;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(clientKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    dispatchUpdated({ clientKey });
  } catch {
    /* noop */
  }
}
