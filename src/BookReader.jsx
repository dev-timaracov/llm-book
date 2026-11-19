import React, { useEffect, useState } from 'react';
import { RefsProvider } from './shared/ui.jsx';
import { loadProgress, saveProgress } from './shared/storage.js';

/** Читалка одного учебника: оглавление слева, глава справа, навигация «назад/дальше». */
export default function BookReader({ book, chapter, themeSelect }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(() => loadProgress(book.id));
  useEffect(() => setOpen(false), [chapter]);

  const chapters = book.chapters;
  const idx = chapters.indexOf(chapter);
  const prev = chapters[idx - 1], next = chapters[idx + 1];
  const Comp = chapter.component;
  const href = (c) => `#/${book.id}/${c.id}`;
  const toggleDone = () => {
    const d = { ...done, [chapter.id]: !done[chapter.id] };
    setDone(d);
    saveProgress(book.id, d);
  };
  const nDone = chapters.filter((c) => done[c.id]).length;

  let lastPart = null;
  return (
    <RefsProvider refs={book.refs}>
      <div className="layout">
        {open && <div className="scrim" onClick={() => setOpen(false)} />}
        <nav className={'sidebar' + (open ? ' open' : '')}>
          <a className="backlink" href="#/">← Все учебники</a>
          <h1>{book.icon} {book.title}</h1>
          <p className="subtitle">{book.subtitle} · пройдено {nDone}/{chapters.length}</p>
          <div className="tools">{themeSelect}</div>
          {chapters.map((c) => {
            const head = c.part && c.part !== lastPart ? <div className="part">{c.part}</div> : null;
            lastPart = c.part;
            return (
              <React.Fragment key={c.id}>
                {head}
                <a className={'navitem' + (c === chapter ? ' active' : '')} href={href(c)}>
                  <span className="num">{c.num}</span>
                  <span>{c.title}</span>
                  {done[c.id] && <span className="done">✓</span>}
                </a>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="main">
          <div className="topbar">
            <button className="btn small" onClick={() => setOpen(true)}>☰ Оглавление</button>
            <span className="muted">{chapter.num}. {chapter.title}</span>
          </div>
          <article className="content">
            <div className="chapter-kicker">{chapter.part ? chapter.part + ' · ' : ''}Глава {chapter.num}</div>
            <Comp />
            <div style={{ marginTop: 40, textAlign: 'center' }}>
              <button className={'btn' + (done[chapter.id] ? '' : ' primary')} onClick={toggleDone}>
                {done[chapter.id] ? '✓ Глава пройдена (снять отметку)' : 'Отметить главу как пройденную'}
              </button>
            </div>
            <div className="pager">
              {prev ? <a href={href(prev)}><div className="dir">← Назад</div>{prev.num}. {prev.title}</a> : <a href="#/"><div className="dir">← К библиотеке</div>Все учебники</a>}
              {next ? <a href={href(next)} style={{ textAlign: 'right' }}><div className="dir">Дальше →</div>{next.num}. {next.title}</a> : <a href="#/" style={{ textAlign: 'right' }}><div className="dir">Учебник пройден →</div>К библиотеке</a>}
            </div>
          </article>
        </div>
      </div>
    </RefsProvider>
  );
}
