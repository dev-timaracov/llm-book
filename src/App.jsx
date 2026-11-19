import React, { useEffect, useState } from 'react';
import { CHAPTERS } from './chapters/index.js';

function readHash() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [id, anchor] = h.split('#');
  return { id: CHAPTERS.find((c) => c.id === id) ? id : CHAPTERS[0].id, anchor };
}

function loadDone() {
  try { return JSON.parse(localStorage.getItem('llmbook-done') || '{}'); } catch { return {}; }
}

export default function App() {
  const [route, setRoute] = useState(readHash);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(loadDone);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('llmbook-theme') || 'auto'; } catch { return 'auto'; } });

  useEffect(() => {
    const on = () => { setRoute(readHash()); setOpen(false); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (route.anchor) document.getElementById(route.anchor)?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [route]);
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('llmbook-theme', theme); } catch { /* приватный режим */ }
  }, [theme]);

  const idx = CHAPTERS.findIndex((c) => c.id === route.id);
  const ch = CHAPTERS[idx];
  const Comp = ch.component;
  const prev = CHAPTERS[idx - 1], next = CHAPTERS[idx + 1];
  const toggleDone = () => {
    const d = { ...done, [ch.id]: !done[ch.id] };
    setDone(d);
    try { localStorage.setItem('llmbook-done', JSON.stringify(d)); } catch { /* ignore */ }
  };
  const nDone = CHAPTERS.filter((c) => done[c.id]).length;

  let lastPart = null;
  return (
    <div className="layout">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <nav className={'sidebar' + (open ? ' open' : '')}>
        <h1>GPT с нуля</h1>
        <p className="subtitle">Интерактивный учебник: от производной до своей обученной языковой модели · пройдено {nDone}/{CHAPTERS.length}</p>
        <div className="tools">
          <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Тема">
            <option value="auto">Тема: как в системе</option>
            <option value="light">Светлая</option>
            <option value="dark">Тёмная</option>
          </select>
        </div>
        {CHAPTERS.map((c) => {
          const head = c.part !== lastPart ? <div className="part">{c.part}</div> : null;
          lastPart = c.part;
          return (
            <React.Fragment key={c.id}>
              {head}
              <a className={'navitem' + (c.id === ch.id ? ' active' : '')} href={'#/' + c.id}>
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
          <span className="muted">{ch.num}. {ch.title}</span>
        </div>
        <article className="content">
          <div className="chapter-kicker">{ch.part} · Глава {ch.num}</div>
          <Comp />
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <button className={'btn' + (done[ch.id] ? '' : ' primary')} onClick={toggleDone}>
              {done[ch.id] ? '✓ Глава пройдена (снять отметку)' : 'Отметить главу как пройденную'}
            </button>
          </div>
          <div className="pager">
            {prev ? <a href={'#/' + prev.id}><div className="dir">← Назад</div>{prev.num}. {prev.title}</a> : <span />}
            {next ? <a href={'#/' + next.id} style={{ textAlign: 'right' }}><div className="dir">Дальше →</div>{next.num}. {next.title}</a> : <span />}
          </div>
        </article>
      </div>
    </div>
  );
}
