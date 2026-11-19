import React from 'react';
import { loadProgress } from './shared/storage.js';

const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

/** Главная страница: список всех учебников. */
export default function Library({ books, themeSelect }) {
  return (
    <div className="library">
      <header className="lib-head">
        <div>
          <h1>Интерактивные учебники</h1>
          <p className="lead">Каждая тема — с нуля: выводы формул, живые визуализации, ссылки на первоисточники и код, который можно запустить.</p>
        </div>
        <div>{themeSelect}</div>
      </header>
      <div className="lib-grid">
        {books.map((b) => {
          const done = loadProgress(b.id);
          const n = b.chapters.filter((c) => done[c.id]).length;
          const started = n > 0;
          return (
            <a key={b.id} className="book-card" href={`#/${b.id}`}>
              <div className="book-icon">{b.icon}</div>
              <h2>{b.title}</h2>
              <p className="book-sub">{b.subtitle}</p>
              <p className="book-desc">{b.description}</p>
              <div className="book-tags">{(b.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}</div>
              <div className="book-meta">
                <span>{b.chapters.length} {plural(b.chapters.length, 'глава', 'главы', 'глав')}{b.level ? ` · ${b.level}` : ''}</span>
                <span>{started ? `пройдено ${n}/${b.chapters.length}` : 'начать →'}</span>
              </div>
              <div className="book-progress"><div style={{ width: `${(100 * n) / b.chapters.length}%` }} /></div>
            </a>
          );
        })}
      </div>
      <p className="muted small" style={{ marginTop: 40 }}>Новые учебники добавляются папкой в <code>books/</code> — инструкция в <code>books/README.md</code> репозитория.</p>
    </div>
  );
}
