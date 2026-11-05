/**
 * Tillfällig artikelsida som bakgrundstjänsten skriver ut när artikelläget
 * är på. Innehållet hämtas från chrome.storage.session och försvinner när
 * fliken stängs.
 */

const KEY = 'readerDoc';

function setReady() {
  document.documentElement.dataset.ready = '1';
  // Berättar för bakgrundstjänsten att utskriften kan börja.
  chrome.runtime.sendMessage({ type: 'READER_READY' }).catch(() => {});
}

function waitForImages() {
  const images = [...document.images];
  return Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
          setTimeout(resolve, 3000);
        })
    )
  );
}

async function boot() {
  let article = null;
  try {
    const stored = await chrome.storage.session.get(KEY);
    article = stored?.[KEY] || null;
  } catch {
    article = null;
  }

  if (!article) {
    setReady();
    return;
  }

  const title = (article.title || document.title || 'Artikel').trim();
  document.title = title;
  document.getElementById('reader-title').textContent = title;

  const content = document.getElementById('reader-content');
  content.innerHTML = article.html || '';

  try {
    const host = new URL(article.url).hostname.replace(/^www\./, '');
    document.getElementById('reader-site').textContent = host;
  } catch {
    document.getElementById('reader-site').textContent = '';
  }

  const now = new Date();
  const date = document.getElementById('reader-date');
  date.dateTime = now.toISOString().slice(0, 10);
  date.textContent = now.toISOString().slice(0, 10);

  await waitForImages();
  setReady();
}

void boot();
