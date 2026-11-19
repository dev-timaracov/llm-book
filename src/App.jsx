import React, { useEffect, useState } from 'react';
import { BOOKS, findBook } from './books.js';
import Library from './Library.jsx';
import BookReader from './BookReader.jsx';
import { storage } from './shared/storage.js';

/**
 * Маршруты (hash-роутинг, работает на GitHub Pages без настройки сервера):
 *   #/                 — библиотека учебников
 *   #/<книга>          — первая глава книги
 *   #/<книга>/<глава>  — глава
 * Старые ссылки вида #/<глава> (когда учебник был один) перенаправляются в книгу «gpt».
 */
function parseHash() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!parts.length) return { view: 'library' };
  const book = findBook(parts[0]);
  if (book) {
    const ch = book.chapters.find((c) => c.id === parts[1]) || book.chapters[0];
    return { view: 'book', book, chapter: ch };
  }
  const legacy = BOOKS.find((b) => b.chapters.some((c) => c.id === parts[0]));
  if (legacy) {
    window.location.replace(`#/${legacy.id}/${parts[0]}`);
    return { view: 'book', book: legacy, chapter: legacy.chapters.find((c) => c.id === parts[0]) };
  }
  return { view: 'library' };
}

export default function App() {
  const [route, setRoute] = useState(parseHash);
  const [theme, setTheme] = useState(() => storage.get('books-theme') || storage.get('llmbook-theme') || 'auto');

  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = route.view === 'book' ? `${route.chapter.title} — ${route.book.title}` : 'Интерактивные учебники';
  }, [route]);
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    storage.set('books-theme', theme);
  }, [theme]);

  const themeSelect = (
    <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Тема">
      <option value="auto">Тема: как в системе</option>
      <option value="light">Светлая</option>
      <option value="dark">Тёмная</option>
    </select>
  );

  if (route.view === 'book') return <BookReader key={route.book.id} book={route.book} chapter={route.chapter} themeSelect={themeSelect} />;
  return <Library books={BOOKS} themeSelect={themeSelect} />;
}
