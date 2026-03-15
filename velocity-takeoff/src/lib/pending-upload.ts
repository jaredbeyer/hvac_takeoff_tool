const DB_NAME = 'velocity-pending-upload';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'projectId' });
    };
  });
}

export async function storePendingUpload(
  projectId: string,
  file: File
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.put({ projectId, file, name: file.name });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getAndClearPendingUpload(
  projectId: string
): Promise<File | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.get(projectId);
    req.onsuccess = () => {
      const row = req.result;
      if (row?.file) {
        store.delete(projectId);
        resolve(row.file as File);
      } else {
        resolve(null);
      }
      db.close();
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}
