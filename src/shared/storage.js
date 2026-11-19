// Обёртка над localStorage: в приватном режиме и превью хранилище может быть недоступно.
export const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* недоступно — работаем без сохранения */ }
  },
  getJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  setJSON(key, value) {
    this.set(key, JSON.stringify(value));
  },
};

/** Отметки «глава пройдена» для книги. Для «gpt» подхватываем ключ из времён, когда учебник был один. */
export function loadProgress(bookId) {
  const p = storage.getJSON(`books-done:${bookId}`, null);
  if (p) return p;
  return bookId === 'gpt' ? storage.getJSON('llmbook-done', {}) : {};
}
export function saveProgress(bookId, done) {
  storage.setJSON(`books-done:${bookId}`, done);
}
