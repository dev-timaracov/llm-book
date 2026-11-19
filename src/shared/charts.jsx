import React, { useEffect, useRef } from 'react';

function niceTicks(lo, hi, n = 5) {
  if (!(hi > lo)) return [lo];
  const span = hi - lo;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const tickFmt = (v) => {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1e7 || a < 1e-3) return v.toExponential(0);
  if (a >= 1e4) return Number.isInteger(v) ? String(v) : String(Math.round(v));
  return String(+v.toPrecision(3));
};

/**
 * Линейный график на SVG.
 * series: [{ data: [[x,y],...], color, label, dashed, width, points }]
 * extra: функция (sx, sy) => JSX — для дорисовки (точек, касательных и т.п.)
 */
export function LineChart({ series, width = 640, height = 300, xDomain, yDomain, xLabel, yLabel, extra, legend = true, logY = false }) {
  const pad = { l: 52, r: 14, t: 12, b: 38 };
  const all = series.flatMap((s) => s.data).filter((p) => Number.isFinite(p[1]));
  const tf = (y) => (logY ? Math.log10(Math.max(y, 1e-12)) : y);
  let [x0, x1] = xDomain || [Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0]))];
  let [y0, y1] = yDomain ? yDomain.map(tf) : [Math.min(...all.map((p) => tf(p[1]))), Math.max(...all.map((p) => tf(p[1])))];
  if (!Number.isFinite(x0)) [x0, x1] = [0, 1];
  if (!Number.isFinite(y0)) [y0, y1] = [0, 1];
  if (x1 === x0) x1 = x0 + 1;
  if (y1 === y0) { y1 = y0 + 1; y0 = y0 - 1; }
  if (!yDomain) { const m = (y1 - y0) * 0.06; y0 -= m; y1 += m; }
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const sx = (x) => pad.l + ((x - x0) / (x1 - x0)) * W;
  const sy = (y) => pad.t + H - ((tf(y) - y0) / (y1 - y0)) * H;
  const xt = niceTicks(x0, x1, 6), yt = niceTicks(y0, y1, 5);
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <g className="grid">
          {yt.map((v) => <line key={'y' + v} x1={pad.l} x2={pad.l + W} y1={pad.t + H - ((v - y0) / (y1 - y0)) * H} y2={pad.t + H - ((v - y0) / (y1 - y0)) * H} />)}
          {xt.map((v) => <line key={'x' + v} y1={pad.t} y2={pad.t + H} x1={sx(v)} x2={sx(v)} />)}
        </g>
        <rect x={pad.l} y={pad.t} width={W} height={H} fill="none" stroke="var(--border)" />
        {yt.map((v) => (
          <text key={'yl' + v} x={pad.l - 6} y={pad.t + H - ((v - y0) / (y1 - y0)) * H + 4} fontSize="11" textAnchor="end">{logY ? tickFmt(Math.pow(10, v)) : tickFmt(v)}</text>
        ))}
        {xt.map((v) => <text key={'xl' + v} x={sx(v)} y={pad.t + H + 15} fontSize="11" textAnchor="middle">{tickFmt(v)}</text>)}
        {xLabel && <text x={pad.l + W / 2} y={height - 4} fontSize="12" textAnchor="middle" style={{ fill: 'var(--muted)' }}>{xLabel}</text>}
        {yLabel && <text x={12} y={pad.t + H / 2} fontSize="12" textAnchor="middle" transform={`rotate(-90 12 ${pad.t + H / 2})`} style={{ fill: 'var(--muted)' }}>{yLabel}</text>}
        <defs><clipPath id="plotclip"><rect x={pad.l} y={pad.t} width={W} height={H} /></clipPath></defs>
        <g clipPath="url(#plotclip)">
          {series.map((s, i) => {
            const pts = s.data.filter((p) => Number.isFinite(p[1]));
            if (!pts.length) return null;
            const d = pts.map((p, j) => `${j ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={s.color || 'var(--c1)'} strokeWidth={s.width || 2} strokeDasharray={s.dashed ? '5 4' : undefined} />
                {s.points && pts.map((p, j) => <circle key={j} cx={sx(p[0])} cy={sy(p[1])} r={3} fill={s.color || 'var(--c1)'} />)}
              </g>
            );
          })}
          {extra && extra(sx, sy)}
        </g>
      </svg>
      {legend && series.some((s) => s.label) && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, justifyContent: 'center' }}>
          {series.filter((s) => s.label).map((s, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 16, height: 3, background: s.color || 'var(--c1)', display: 'inline-block', borderRadius: 2 }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Тепловая карта матрицы. values: number[][], диапазон [lo, hi]; diverging — синий/красный вокруг 0. */
export function Heatmap({ values, rowLabels, colLabels, lo, hi, diverging = false, cell = 30, showValues = true, digits = 2, onCellClick, highlight }) {
  const flat = values.flat().filter(Number.isFinite);
  const vmin = lo ?? Math.min(...flat), vmax = hi ?? Math.max(...flat);
  const color = (v) => {
    if (!Number.isFinite(v)) return 'transparent';
    if (diverging) {
      const m = Math.max(Math.abs(vmin), Math.abs(vmax)) || 1;
      const t = Math.max(-1, Math.min(1, v / m));
      return t >= 0 ? `rgba(224, 49, 49, ${0.08 + 0.85 * t})` : `rgba(59, 91, 219, ${0.08 + 0.85 * -t})`;
    }
    const t = vmax > vmin ? (v - vmin) / (vmax - vmin) : 0;
    return `rgba(59, 91, 219, ${0.04 + 0.92 * t})`;
  };
  const labW = rowLabels ? 56 : 0, labH = colLabels ? 26 : 0;
  const nR = values.length, nC = values[0]?.length || 0;
  const w = labW + nC * cell, h = labH + nR * cell;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: w * 1.4, height: 'auto', display: 'block' }}>
      {colLabels && colLabels.map((l, j) => (
        <text key={'c' + j} x={labW + j * cell + cell / 2} y={labH - 8} fontSize="11" textAnchor="middle" className="mono">{l}</text>
      ))}
      {rowLabels && rowLabels.map((l, i) => (
        <text key={'r' + i} x={labW - 6} y={labH + i * cell + cell / 2 + 4} fontSize="11" textAnchor="end" className="mono">{l}</text>
      ))}
      {values.map((row, i) => row.map((v, j) => {
        const t = vmax > vmin ? (v - vmin) / (vmax - vmin) : 0;
        const isHl = highlight && highlight(i, j);
        return (
          <g key={i + '_' + j} onClick={onCellClick ? () => onCellClick(i, j) : undefined} style={{ cursor: onCellClick ? 'pointer' : 'default' }}>
            <rect x={labW + j * cell} y={labH + i * cell} width={cell - 1} height={cell - 1} fill={color(v)} stroke={isHl ? 'var(--amber)' : 'var(--border)'} strokeWidth={isHl ? 2 : 0.5} rx="2" />
            {showValues && Number.isFinite(v) && (
              <text x={labW + j * cell + cell / 2} y={labH + i * cell + cell / 2 + 3.5} fontSize={cell > 34 ? 11 : 9} textAnchor="middle"
                style={{ fill: !diverging && t > 0.55 ? '#fff' : 'var(--text)' }}>
                {v.toFixed(digits)}
              </text>
            )}
          </g>
        );
      }))}
    </svg>
  );
}

/**
 * Карта уровня функции двух переменных на <canvas> + траектории.
 * f(x,y) — функция; domain: [x0,x1,y0,y1]; paths: [{pts:[[x,y]], color}]
 */
export function ContourCanvas({ f, domain, paths = [], size = 420, onClick, logScale = true }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const N = size;
    const [x0, x1, y0, y1] = domain;
    const img = ctx.createImageData(N, N);
    let vals = new Float32Array(N * N), lo = Infinity, hi = -Infinity;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = x0 + ((i + 0.5) / N) * (x1 - x0), y = y1 - ((j + 0.5) / N) * (y1 - y0);
      let v = f(x, y);
      if (logScale) v = Math.log(1 + Math.max(0, v));
      vals[j * N + i] = v; lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    const levels = 18;
    for (let k = 0; k < N * N; k++) {
      const t = (vals[k] - lo) / (hi - lo || 1);
      const band = Math.floor(t * levels) / levels;
      const r = 40 + 200 * band, g = 70 + 150 * (1 - Math.abs(band - 0.5) * 2), b = 230 - 190 * band;
      img.data[4 * k] = r; img.data[4 * k + 1] = g; img.data[4 * k + 2] = b; img.data[4 * k + 3] = 140;
    }
    ctx.putImageData(img, 0, 0);
    const tx = (x) => ((x - x0) / (x1 - x0)) * N, ty = (y) => ((y1 - y) / (y1 - y0)) * N;
    for (const p of paths) {
      if (!p.pts.length) continue;
      ctx.strokeStyle = p.color; ctx.lineWidth = 2.2; ctx.beginPath();
      p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(tx(x), ty(y)) : ctx.moveTo(tx(x), ty(y))));
      ctx.stroke();
      const [lx, ly] = p.pts[p.pts.length - 1];
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(tx(lx), ty(ly), 5, 0, 2 * Math.PI); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }, [f, domain, paths, size, logScale]);
  const click = (e) => {
    if (!onClick) return;
    const rect = ref.current.getBoundingClientRect();
    const [x0, x1, y0, y1] = domain;
    const x = x0 + ((e.clientX - rect.left) / rect.width) * (x1 - x0);
    const y = y1 - ((e.clientY - rect.top) / rect.height) * (y1 - y0);
    onClick(x, y);
  };
  return <canvas ref={ref} width={size} height={size} onClick={click} style={{ width: '100%', maxWidth: size, aspectRatio: '1', borderRadius: 8, border: '1px solid var(--border)', cursor: onClick ? 'crosshair' : 'default', display: 'block' }} />;
}
