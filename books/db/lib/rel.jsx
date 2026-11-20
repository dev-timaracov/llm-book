import React from 'react';

/** Отношение (таблица): { cols: ['id', 'name'], rows: [[1, 'Аня'], ...] } */
export function Rel({ rel, title, highlight, max = 50, nullText = 'NULL' }) {
  if (!rel) return null;
  const rows = rel.rows.slice(0, max);
  return (
    <div style={{ display: 'inline-block', verticalAlign: 'top', marginRight: 14, marginBottom: 8, maxWidth: '100%', overflowX: 'auto' }}>
      {title && <div className="small" style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>}
      <table className="small" style={{ display: 'table', width: 'auto', margin: 0 }}>
        <thead><tr>{rel.cols.map((c) => <th key={c} className="mono">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: highlight && highlight(r, i) ? 'var(--amber-soft)' : undefined }}>
              {r.map((v, j) => <td key={j} className="mono" style={{ color: v === null ? 'var(--muted)' : undefined, fontStyle: v === null ? 'italic' : undefined }}>{v === null ? nullText : String(v)}</td>)}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={rel.cols.length} className="muted">пусто</td></tr>}
        </tbody>
      </table>
      {rel.rows.length > max && <div className="small muted">… ещё {rel.rows.length - max}</div>}
      <div className="small muted">{rel.rows.length} {rel.rows.length % 10 === 1 && rel.rows.length % 100 !== 11 ? 'строка' : [2, 3, 4].includes(rel.rows.length % 10) && ![12, 13, 14].includes(rel.rows.length % 100) ? 'строки' : 'строк'}</div>
    </div>
  );
}

// ---------- операции реляционной алгебры над {cols, rows} ----------
const idx = (rel, c) => { const i = rel.cols.indexOf(c); if (i < 0) throw new Error('нет столбца ' + c); return i; };
const uniq = (rows) => { const seen = new Set(); return rows.filter((r) => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); };
const obj = (rel, r) => Object.fromEntries(rel.cols.map((c, i) => [c, r[i]]));

export const RA = {
  select: (rel, pred) => ({ cols: rel.cols, rows: rel.rows.filter((r) => pred(obj(rel, r))) }),
  project: (rel, cols, distinct = true) => { const ix = cols.map((c) => idx(rel, c)); const rows = rel.rows.map((r) => ix.map((i) => r[i])); return { cols, rows: distinct ? uniq(rows) : rows }; },
  rename: (rel, map) => ({ cols: rel.cols.map((c) => map[c] || c), rows: rel.rows }),
  product: (a, b) => ({ cols: [...a.cols, ...b.cols], rows: a.rows.flatMap((x) => b.rows.map((y) => [...x, ...y])) }),
  union: (a, b) => ({ cols: a.cols, rows: uniq([...a.rows, ...b.rows]) }),
  difference: (a, b) => { const s = new Set(b.rows.map((r) => JSON.stringify(r))); return { cols: a.cols, rows: a.rows.filter((r) => !s.has(JSON.stringify(r))) }; },
  intersect: (a, b) => { const s = new Set(b.rows.map((r) => JSON.stringify(r))); return { cols: a.cols, rows: uniq(a.rows.filter((r) => s.has(JSON.stringify(r)))) }; },
  /** естественное соединение по одноимённым столбцам */
  natjoin: (a, b) => {
    const common = a.cols.filter((c) => b.cols.includes(c));
    const extra = b.cols.filter((c) => !common.includes(c));
    const rows = [];
    for (const x of a.rows) for (const y of b.rows) {
      if (common.every((c) => x[idx(a, c)] === y[idx(b, c)] && x[idx(a, c)] !== null)) rows.push([...x, ...extra.map((c) => y[idx(b, c)])]);
    }
    return { cols: [...a.cols, ...extra], rows };
  },
  /** внешние и полу-соединения по условию la = rb */
  join: (a, b, la, rb, kind = 'inner') => {
    const li = idx(a, la), ri = idx(b, rb);
    const match = (x, y) => x[li] !== null && x[li] === y[ri];
    if (kind === 'semi') return { cols: a.cols, rows: a.rows.filter((x) => b.rows.some((y) => match(x, y))) };
    if (kind === 'anti') return { cols: a.cols, rows: a.rows.filter((x) => !b.rows.some((y) => match(x, y))) };
    const rows = [];
    const usedR = new Set();
    for (const x of a.rows) {
      let any = false;
      b.rows.forEach((y, j) => { if (match(x, y)) { rows.push([...x, ...y]); any = true; usedR.add(j); } });
      if (!any && (kind === 'left' || kind === 'full')) rows.push([...x, ...b.cols.map(() => null)]);
    }
    if (kind === 'right' || kind === 'full') b.rows.forEach((y, j) => { if (!usedR.has(j)) rows.push([...a.cols.map(() => null), ...y]); });
    if (kind === 'right') return { cols: [...a.cols, ...b.cols], rows: rows.filter((r) => b.rows.some((y) => JSON.stringify(y) === JSON.stringify(r.slice(a.cols.length)))) };
    return { cols: [...a.cols, ...b.cols], rows };
  },
  /** деление: значения X из a(X, Y), сочетающиеся со ВСЕМИ Y из b(Y) */
  divide: (a, b) => {
    const ycols = b.cols, xcols = a.cols.filter((c) => !ycols.includes(c));
    const xs = RA.project(a, xcols).rows;
    const have = new Set(RA.project(a, [...xcols, ...ycols]).rows.map((r) => JSON.stringify(r)));
    return { cols: xcols, rows: xs.filter((x) => b.rows.every((y) => have.has(JSON.stringify([...x, ...y])))) };
  },
  /** группировка: by — столбцы, aggs — [{name, fn: 'count'|'sum'|'avg'|'max'|'min', col}] */
  group: (rel, by, aggs) => {
    const g = new Map();
    for (const r of rel.rows) { const k = JSON.stringify(by.map((c) => r[idx(rel, c)])); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
    const rows = [...g.entries()].map(([k, rs]) => [...JSON.parse(k), ...aggs.map(({ fn, col }) => {
      const vals = col ? rs.map((r) => r[idx(rel, col)]).filter((v) => v !== null) : rs;
      if (fn === 'count') return vals.length;
      if (!vals.length) return null;
      if (fn === 'sum') return vals.reduce((a, b) => a + b, 0);
      if (fn === 'avg') return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
      if (fn === 'max') return Math.max(...vals);
      return Math.min(...vals);
    })]);
    return { cols: [...by, ...aggs.map((a) => a.name)], rows };
  },
  sort: (rel, col, desc) => { const i = idx(rel, col); return { cols: rel.cols, rows: [...rel.rows].sort((x, y) => (x[i] < y[i] ? -1 : x[i] > y[i] ? 1 : 0) * (desc ? -1 : 1)) }; },
  limit: (rel, n) => ({ cols: rel.cols, rows: rel.rows.slice(0, n) }),
};
