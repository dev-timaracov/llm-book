import React, { createContext, useContext, useMemo, useState } from 'react';
import katex from 'katex';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import javascript from 'highlight.js/lib/languages/javascript';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';

hljs.registerLanguage('python', python);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sql', sql);

/**
 * Библиография текущего учебника. Платформа оборачивает книгу в <RefsProvider refs={book.refs}>,
 * и <Cite id="..." /> ищет ссылки в библиографии именно этой книги.
 */
const RefsContext = createContext({});
export function RefsProvider({ refs = [], children }) {
  const index = useMemo(() => Object.fromEntries(refs.map((r, i) => [r.id, { ...r, n: i + 1 }])), [refs]);
  return <RefsContext.Provider value={index}>{children}</RefsContext.Provider>;
}
const useRefs = () => useContext(RefsContext);

/** Удобный псевдоним: r`\frac{a}{b}` — строка без экранирования обратных слэшей. */
export const r = String.raw;

/** Формула в строке: <M>{r`x^2`}</M> или <M t={r`x^2`} /> */
export function M({ t, children }) {
  const src = t ?? (Array.isArray(children) ? children.join('') : children) ?? '';
  const html = useMemo(() => katex.renderToString(String(src), { throwOnError: false, strict: false }), [src]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Выключная формула с необязательной подписью. */
export function Eq({ t, children, label }) {
  const src = t ?? (Array.isArray(children) ? children.join('') : children) ?? '';
  const html = useMemo(
    () => katex.renderToString(String(src), { throwOnError: false, displayMode: true, strict: false, trust: true }),
    [src]
  );
  return (
    <div className="eq">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {label && <div className="eq-label">{label}</div>}
    </div>
  );
}

/** Блок кода с подсветкой, кнопкой «копировать» и сворачиванием длинных листингов. */
export function Code({ children, lang = 'python', title, collapse }) {
  const code = String(children).replace(/^\n/, '').replace(/\s+$/, '');
  const lines = code.split('\n').length;
  const collapsible = collapse ?? lines > 40;
  const [open, setOpen] = useState(!collapsible);
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => {
    try {
      return hljs.highlight(code, { language: lang }).value;
    } catch {
      return code.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    }
  }, [code, lang]);
  const copy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1200); };
    const fallback = () => {
      // запасной путь для браузеров без доступа к Clipboard API (http, встроенные окна)
      try {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) done();
      } catch { /* копирование недоступно — ничего не делаем */ }
    };
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done, fallback);
      else fallback();
    } catch {
      fallback();
    }
  };
  return (
    <div className={'codeblock' + (collapsible && !open ? ' collapsed' : '')}>
      <div className="codehead">
        <span>{title || lang}{lines > 1 ? ` · ${lines} строк` : ''}</span>
        <button className="btn small" onClick={copy}>{copied ? 'скопировано ✓' : 'копировать'}</button>
      </div>
      <pre><code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /></pre>
      {collapsible && (
        <button className="expand" onClick={() => setOpen(!open)}>{open ? 'свернуть ▲' : `показать весь код (${lines} строк) ▼`}</button>
      )}
    </div>
  );
}

/** Ссылка на статью из библиографии: <Cite id="vaswani2017" /> или несколько: <Cite id="a,b" /> */
export function Cite({ id }) {
  const REF_INDEX = useRefs();
  const ids = id.split(',').map((s) => s.trim());
  return (
    <span className="cite">
      [
      {ids.map((k, i) => {
        const ref = REF_INDEX[k];
        if (!ref) return <span key={k} style={{ color: 'red' }}>?{k}</span>;
        return (
          <React.Fragment key={k}>
            {i > 0 && ','}
            <a href={ref.url} target="_blank" rel="noreferrer" title={`${ref.authors} (${ref.year}). ${ref.title}. ${ref.venue}`}>
              {ref.n}
            </a>
          </React.Fragment>
        );
      })}
      ]
    </span>
  );
}

/** Ссылка на статью прямо в тексте: «<Paper id="vaswani2017" />» → «Attention Is All You Need (Vaswani и др., 2017)» */
export function Paper({ id }) {
  const REF_INDEX = useRefs();
  const ref = REF_INDEX[id];
  if (!ref) return <span style={{ color: 'red' }}>?{id}</span>;
  const first = ref.authors.split(',')[0].trim().split(' ').slice(-1)[0];
  const many = ref.authors.includes(',');
  return (
    <a href={ref.url} target="_blank" rel="noreferrer" title={ref.authors}>
      «{ref.title}» ({first}{many ? ' и др.' : ''}, {ref.year})
    </a>
  );
}

const CALLOUT_TITLES = { note: 'Заметка', tip: 'Интуиция', warn: 'Осторожно', history: 'История', danger: 'Частая ошибка', math: 'Математика' };

export function Callout({ type = 'note', title, children }) {
  return (
    <div className={'callout ' + type}>
      <div className="ctitle">{title || CALLOUT_TITLES[type]}</div>
      {children}
    </div>
  );
}

/** Контрольный вопрос. answer — индекс правильного варианта. */
export function Quiz({ q, options, answer, explain }) {
  const [picked, setPicked] = useState(null);
  return (
    <div className="quiz">
      <div className="q">🧩 Проверь себя: {q}</div>
      {options.map((o, i) => (
        <button
          key={i}
          className={'opt' + (picked !== null && i === answer ? ' right' : '') + (picked === i && i !== answer ? ' wrong' : '')}
          onClick={() => setPicked(i)}
        >
          {o}
        </button>
      ))}
      {picked !== null && (
        <div className="expl">
          {picked === answer ? '✅ Верно. ' : '❌ Не совсем. '}
          {explain}
        </div>
      )}
    </div>
  );
}

export function Widget({ title, children, footer, badge = 'интерактив' }) {
  return (
    <div className="widget">
      <div className="whead">
        {badge && <span className="badge">{badge}</span>}
        {title}
      </div>
      <div className="wbody">{children}</div>
      {footer && <div className="wfoot">{footer}</div>}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format }) {
  return (
    <label className="slider">
      <span className="sl-label">
        <span>{label}</span>
        <b>{format ? format(value) : value}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function Stat({ k, v }) {
  return (
    <div className="stat">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

/** Горизонтальные столбики вероятностей. items: [{label, value, off}] */
export function Bars({ items, max, digits = 3 }) {
  const m = max ?? Math.max(1e-9, ...items.map((i) => i.value));
  return (
    <div>
      {items.map((it, i) => (
        <div className="bar-row" key={i}>
          <span className="lbl">{it.label}</span>
          <span className="track">
            <span className={'fill' + (it.off ? ' off' : '')} style={{ width: `${(100 * it.value) / m}%`, display: 'block', background: it.color }} />
          </span>
          <span className="val">{it.value.toFixed(digits)}</span>
        </div>
      ))}
    </div>
  );
}

export const fmt = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : x === Infinity ? '∞' : x === -Infinity ? '−∞' : '—');
export const fmtBig = (x) => {
  if (!Number.isFinite(x)) return String(x);
  const a = Math.abs(x);
  if (a >= 1e12) return (x / 1e12).toFixed(2) + ' трлн';
  if (a >= 1e9) return (x / 1e9).toFixed(2) + ' млрд';
  if (a >= 1e6) return (x / 1e6).toFixed(2) + ' млн';
  if (a >= 1e3) return (x / 1e3).toFixed(1) + ' тыс';
  return x.toFixed(0);
};
