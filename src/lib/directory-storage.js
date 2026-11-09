const DB_NAME = 'sida-till-pdf';
const DB_VERSION = 1;
const STORE_NAME = 'saved-location';
const HANDLE_KEY = 'directory-handle';
const PICKER_ID_KEY = 'save-picker-id';
const START_IN_PENDING_KEY = 'start-in-pending';
const PICKED_FILE_PREFIX = 'picked-file:';

function newPickerId() {
  const random = globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 24)
    || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
  return `st-${random}`.slice(0, 32);
}

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

export async function shouldStartInSavedDirectory() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(START_IN_PENDING_KEY);
    const pending = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result === true);
      request.onerror = () => reject(request.error || new Error('Could not read saved-folder start state'));
    });
    await transactionDone(transaction);
    return pending;
  } finally {
    database.close();
  }
}

export async function clearSavedDirectoryStartIn() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(START_IN_PENDING_KEY);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function getOrCreateSavePickerId() {
  const database = await openDatabase();
  try {
    let transaction = database.transaction(STORE_NAME, 'readonly');
    let request = transaction.objectStore(STORE_NAME).get(PICKER_ID_KEY);
    const existingId = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Could not read save picker id'));
    });
    await transactionDone(transaction);
    if (typeof existingId === 'string' && existingId) return existingId;

    const pickerId = newPickerId();
    transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(pickerId, PICKER_ID_KEY);
    await transactionDone(transaction);
    return pickerId;
  } finally {
    database.close();
  }
}

export async function saveDirectoryHandle(handle) {
  if (!handle || handle.kind !== 'directory') throw new TypeError('A directory handle is required');
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(handle, HANDLE_KEY);
    store.put(newPickerId(), PICKER_ID_KEY);
    store.put(true, START_IN_PENDING_KEY);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function clearDirectoryHandle() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(HANDLE_KEY);
    store.delete(START_IN_PENDING_KEY);
    store.put(newPickerId(), PICKER_ID_KEY);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function savePickedFileHandle(token, handle) {
  if (!token || !handle || handle.kind !== 'file') throw new TypeError('A picked file handle and token are required');
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(handle, `${PICKED_FILE_PREFIX}${token}`);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function getPickedFileHandle(token) {
  if (!token) return null;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(`${PICKED_FILE_PREFIX}${token}`);
    const handle = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Could not read picked file'));
    });
    await transactionDone(transaction);
    return handle;
  } finally {
    database.close();
  }
}

export async function clearPickedFileHandle(token) {
  if (!token) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(`${PICKED_FILE_PREFIX}${token}`);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
