const DB_NAME = 'sida-till-pdf';
const DB_VERSION = 1;
const STORE_NAME = 'saved-location';
const HANDLE_KEY = 'directory-handle';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open saved-folder storage'));
    request.onblocked = () => reject(new Error('Saved-folder storage is blocked'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Saved-folder transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Saved-folder transaction aborted'));
  });
}

async function readHandle() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(HANDLE_KEY);
    const handle = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Could not read saved folder'));
    });
    await transactionDone(transaction);
    return handle;
  } finally {
    database.close();
  }
}

export async function getSavedDirectoryHandle() {
  return readHandle();
}

export async function saveDirectoryHandle(handle) {
  if (!handle || handle.kind !== 'directory') throw new TypeError('A directory handle is required');
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function clearDirectoryHandle() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(HANDLE_KEY);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
