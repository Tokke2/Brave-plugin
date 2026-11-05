/**
 * Klassiskt skript som körs före CSS:en så att rätt tema målas direkt.
 * Läser det cachade temat från localStorage och faller tillbaka på systemets.
 */
(function () {
  var resolved = '';
  try {
    resolved = localStorage.getItem('theme') || '';
  } catch (error) {
    resolved = '';
  }
  if (resolved !== 'dark' && resolved !== 'light') {
    try {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (error) {
      resolved = 'light';
    }
  }
  document.documentElement.setAttribute('data-theme', resolved);
})();
