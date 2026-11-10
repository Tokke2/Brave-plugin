/**
 * Osynligt hjälpdokument för blob-URL:er och lokal PDF-analys.
 * PDF.js och pdf-lib används bara när användaren slagit på tomsidanalys.
 */

import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';
import { isBlankPageRaster } from './lib/pdf-analysis.js';
import { findAvailableName } from './lib/filename.js';
import {
  getSavedDirectoryHandle,
  getPickedFileHandle,
  clearPickedFileHandle
} from './lib/directory-storage.js';

const REVOKE_AFTER_MS = 120000;
const CLOSE_AFTER_IDLE_MS = 180000;
const MAX_ANALYZED_PAGES = 400;
const RENDER_SCALE = 0.34;

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('src/vendor/pdfjs/pdf.worker.min.mjs');

const revokeTimers = new Map();
let idleTimer = null;
let directoryWriteQueue = Promise.resolve();

function scheduleIdleClose() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    window.close();
  }, CLOSE_AFTER_IDLE_MS);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function base64ToBlob(base64, mime) {
  return new Blob([base64ToBytes(base64)], { type: mime });
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function sanitizePdfName(value) {
  let name = String(value || 'Sida till PDF.pdf').split(/[\\/]/).pop();
  name = name.replace(/[\u0000-\u001f<>:"|?*]/g, '_').trim().replace(/[. ]+$/, '');
  if (!name) name = 'Sida till PDF.pdf';
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
}

async function writeToSavedDirectory(base64, requestedName, conflictAction = 'uniquify') {
  const directory = await getSavedDirectoryHandle();
  if (!directory) return { ok: false, reason: 'not-configured' };
  let permission = 'denied';
  try {
    permission = await directory.queryPermission({ mode: 'readwrite' });
  } catch {
    /* A missing or revoked handle falls back to the normal browser dialog. */
  }
  if (permission !== 'granted') return { ok: false, reason: 'permission' };

  const safeName = sanitizePdfName(requestedName);
  const filename = conflictAction === 'overwrite'
    ? safeName
    : await findAvailableName(directory, safeName);
  const file = await directory.getFileHandle(filename, { create: true });
  const writable = await file.createWritable({ keepExistingData: false });
  try {
    await writable.write(base64ToBytes(base64));
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  }
  return { ok: true, filename, folderName: directory.name };
}

async function writeToPickedFile(base64, token) {
  const file = await getPickedFileHandle(token);
  if (!file || file.kind !== 'file') return { ok: false, reason: 'missing-handle' };
  let permission = 'denied';
  try {
    permission = await file.queryPermission({ mode: 'readwrite' });
  } catch {
    /* A revoked handle falls back to the browser's normal save dialog. */
  }
  if (permission !== 'granted') return { ok: false, reason: 'permission' };

  const writable = await file.createWritable({ keepExistingData: false });
  try {
    await writable.write(base64ToBytes(base64));
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  }
  return { ok: true, filename: sanitizePdfName(file.name) };
}

function revoke(url) {
  const timer = revokeTimers.get(url);
  if (timer) clearTimeout(timer);
  revokeTimers.delete(url);
  URL.revokeObjectURL(url);
}

async function removeBlankPages(base64) {
  const bytes = base64ToBytes(base64);
  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
    useSystemFonts: true,
    stopAtErrors: false
  });
  let pdf = null;
  try {
    pdf = await loadingTask.promise;
    if (!pdf.numPages || pdf.numPages > MAX_ANALYZED_PAGES) {
      return { base64, removed: 0, skipped: true };
    }

    const blankIndexes = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        page.cleanup();
        continue;
      }
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      try {
        await page.render({
          canvasContext: context,
          viewport,
          background: 'rgb(255,255,255)'
        }).promise;
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        if (isBlankPageRaster(image.data, canvas.width, canvas.height)) blankIndexes.push(pageNumber - 1);
      } catch (error) {
        // If rendering is uncertain, keep the page rather than risk losing content.
        console.warn('Blank-page analysis skipped a page', error);
      } finally {
        page.cleanup();
        canvas.width = 1;
        canvas.height = 1;
      }
    }

    const pageCount = pdf.numPages;
    await pdf.destroy();
    pdf = null;
    if (!blankIndexes.length || blankIndexes.length >= pageCount) {
      return { base64, removed: 0, allBlank: blankIndexes.length >= pageCount && pageCount > 0 };
    }

    const editable = await window.PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    for (const index of blankIndexes.sort((a, b) => b - a)) editable.removePage(index);
    const output = await editable.save({ useObjectStreams: true });
    return { base64: bytesToBase64(output), removed: blankIndexes.length };
  } finally {
    if (pdf) await pdf.destroy().catch(() => {});
    await loadingTask.destroy().catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target !== 'offscreen') return undefined;

  if (message.type === 'MAKE_BLOB_URL') {
    try {
      const blob = base64ToBlob(message.base64, message.mime || 'application/pdf');
      const url = URL.createObjectURL(blob);
      revokeTimers.set(url, setTimeout(() => revoke(url), REVOKE_AFTER_MS));
      scheduleIdleClose();
      sendResponse({ ok: true, url });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || error) });
    }
    return true;
  }

  if (message.type === 'SAVE_TO_REMEMBERED_FOLDER') {
    clearTimeout(idleTimer);
    directoryWriteQueue = directoryWriteQueue
      .then(() => writeToSavedDirectory(message.base64, message.filename, message.conflictAction))
      .then((result) => {
        scheduleIdleClose();
        sendResponse(result);
      })
      .catch((error) => {
        scheduleIdleClose();
        sendResponse({ ok: false, reason: 'write-failed', error: String(error?.message || error) });
      });
    return true;
  }

  if (message.type === 'SAVE_TO_PICKED_FILE') {
    clearTimeout(idleTimer);
    directoryWriteQueue = directoryWriteQueue
      .then(async () => {
        try {
          return await writeToPickedFile(message.base64, message.token);
        } finally {
          await clearPickedFileHandle(message.token).catch(() => {});
        }
      })
      .then((result) => {
        scheduleIdleClose();
        sendResponse(result);
      })
      .catch((error) => {
        scheduleIdleClose();
        sendResponse({ ok: false, reason: 'write-failed', error: String(error?.message || error) });
      });
    return true;
  }

  if (message.type === 'REMOVE_BLANK_PAGES') {
    clearTimeout(idleTimer);
    removeBlankPages(message.base64)
      .then((result) => {
        scheduleIdleClose();
        sendResponse({ ok: true, ...result });
      })
      .catch((error) => {
        scheduleIdleClose();
        sendResponse({ ok: false, error: String(error?.message || error) });
      });
    return true;
  }

  if (message.type === 'REVOKE_BLOB_URL' && message.url) {
    revoke(message.url);
    scheduleIdleClose();
    sendResponse({ ok: true });
    return true;
  }

  return undefined;
});

scheduleIdleClose();
