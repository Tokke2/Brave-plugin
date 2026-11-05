/**
 * Osynligt hjälpdokument.
 *
 * Service workern kan inte skapa blob-URL:er (URL.createObjectURL saknas), och
 * chrome.downloads klipper data-URL:er som är större än cirka 2 MB. Här byggs
 * därför en riktig blob som bakgrundstjänsten kan ladda ner.
 */

const REVOKE_AFTER_MS = 120000;
const CLOSE_AFTER_IDLE_MS = 180000;

const revokeTimers = new Map();
let idleTimer = null;

function scheduleIdleClose() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    // Stängs när inget har hänt på ett tag – då frigörs minnet.
    window.close();
  }, CLOSE_AFTER_IDLE_MS);
}

function base64ToBlob(base64, mime) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function revoke(url) {
  const timer = revokeTimers.get(url);
  if (timer) clearTimeout(timer);
  revokeTimers.delete(url);
  URL.revokeObjectURL(url);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target !== 'offscreen') return undefined;

  if (message.type === 'MAKE_BLOB_URL') {
    try {
      const blob = base64ToBlob(message.base64, message.mime || 'application/pdf');
      const url = URL.createObjectURL(blob);
      revokeTimers.set(
        url,
        setTimeout(() => revoke(url), REVOKE_AFTER_MS)
      );
      scheduleIdleClose();
      sendResponse({ ok: true, url });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || error) });
    }
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
