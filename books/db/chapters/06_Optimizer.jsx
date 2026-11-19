import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt, fmtBig } from '@shared/ui.jsx';
import { makeRng } from '@shared/rng.js';
import { LineChart } from '@shared/charts.jsx';

// ---------- оценка селективности: равномерность против гистограммы ----------
function SelectivityWidget() {
  const [skew, setSkew] = useState(1.2);
  const [buckets, setBuckets] = useState(10);
  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(10);
  const data = useMemo(() => {
    const rng = makeRng(2);
    // «возраст покупателя» со смещением к малым значениям: степенное распределение на [0, 100)
    return Array.from({ length: 20000 }, () => Math.floor(100 * Math.pow(rng.rand(), skew)));
  }, [skew]);
  const sorted = useMemo(() => [...data].sort((a, b) => a - b), [data]);
  // гистограмма равной высоты (equi-depth): границы — квантили
  const bounds = useMemo(() => Array.from({ length: buckets + 1 }, (_, i) => (i === buckets ? 100 : sorted[Math.floor((i * sorted.length) / buckets)])), [sorted, buckets]);
  const truth = data.filter((x) => x >= lo && x < hi).length;
  const uniform = (data.length * Math.max(0, hi - lo)) / 100;
  let hist = 0;
  for (let b = 0; b < buckets; b++) {
    const a = bounds[b], z = bounds[b + 1], per = data.length / buckets;
    if (z <= a) { if (a >= lo && a < hi) hist += per; continue; }
    const overlap = Math.max(0, Math.min(hi, z) - Math.max(lo, a));
    hist += (per * overlap) / (z - a);
  }
  const counts = Array.from({ length: 50 }, (_, i) => [i * 2 + 1, data.filter((x) => x >= i * 2 && x < i * 2 + 2).length]);
  return (
    <Widget title="Оценка числа строк: «равномерно» против гистограммы">
      <div className="controls">
        <Slider label="перекос данных" value={skew} min={1} max={4} step={0.1} onChange={setSkew} />
        <Slider label="корзин гистограммы" value={buckets} min={1} max={50} onChange={setBuckets} />
        <Slider label="WHERE age ≥" value={lo} min={0} max={99} onChange={(v) => { setLo(v); if (v >= hi) setHi(v + 1); }} />
        <Slider label="AND age <" value={hi} min={1} max={100} onChange={(v) => { setHi(v); if (v <= lo) setLo(v - 1); }} />
      </div>
      <LineChart height={170} series={[{ data: counts, color: 'var(--c1)' }]} legend={false} xLabel="значение age" yLabel="строк"
        extra={(sx) => <>
          <rect x={sx(lo)} y={0} width={Math.max(1, sx(hi) - sx(lo))} height={400} fill="var(--amber)" opacity={0.15} />
          {bounds.map((b, i) => <line key={i} x1={sx(b)} x2={sx(b)} y1={0} y2={400} stroke="var(--c3)" strokeDasharray="2 3" />)}
        </>} />
      <div className="stats">
        <Stat k="истинное число строк" v={truth} />
        <Stat k="оценка «равномерно»" v={`${Math.round(uniform)} (×${fmt(uniform / Math.max(1, truth), 2)})`} />
        <Stat k="оценка по гистограмме" v={`${Math.round(hist)} (×${fmt(hist / Math.max(1, truth), 2)})`} />
      </div>
      <p className="small muted">Зелёный пунктир — границы корзин гистограммы равной высоты (в каждой ~{Math.round(data.length / buckets)} строк). При перекошенных данных предположение о равномерности ошибается в разы; гистограмма почти точна. PostgreSQL хранит такие гистограммы и список самых частых значений в <code>pg_stats</code> (собирает <code>ANALYZE</code>).</p>
    </Widget>
  );
}

// ---------- порядок соединений: перебор и динамическое программирование ----------
const TABLES = ['A', 'B', 'C', 'D'];
function JoinOrderWidget() {
  const [card, setCard] = useState({ A: 1000000, B: 1000, C: 50000, D: 10 });
  const [sel, setSel] = useState({ AB: 0.001, BC: 0.0001, CD: 0.05, AD: 0.0005 });
  // предикаты соединения: цепочка A–B–C–D плюс A–D
  const edges = Object.keys(sel);
  const size = (set) => {
    let s = set.reduce((p, t) => p * card[t], 1);
    for (const e of edges) if (set.includes(e[0]) && set.includes(e[1])) s *= sel[e];
    return Math.max(1, s);
  };
  const connected = (a, b) => edges.some((e) => (a.includes(e[0]) && b.includes(e[1])) || (a.includes(e[1]) && b.includes(e[0])));
  // все левоглубокие порядки (перестановки); стоимость C_out = сумма размеров промежуточных результатов
  const perms = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p])));
  const all = perms(TABLES).map((p) => {
    let cost = 0, cross = false;
    for (let i = 2; i <= p.length; i++) { if (!connected(p.slice(0, i - 1), [p[i - 1]])) cross = true; cost += size(p.slice(0, i)); }
    return { p, cost, cross };
  }).sort((a, b) => a.cost - b.cost);
  // DP Селинджер: лучший план для каждого подмножества
  const best = {};
  TABLES.forEach((t) => (best[t] = { cost: 0, plan: t }));
  const subsets = [];
  for (let m = 1; m < 16; m++) subsets.push(TABLES.filter((_, i) => m & (1 << i)));
  subsets.sort((a, b) => a.length - b.length).forEach((S) => {
    if (S.length < 2) return;
    const key = S.join('');
    for (const t of S) {
      const rest = S.filter((x) => x !== t), rk = rest.join('');
      if (!best[rk] || !connected(rest, [t])) continue;
      const c = best[rk].cost + size(S);
      if (!best[key] || c < best[key].cost) best[key] = { cost: c, plan: `(${best[rk].plan} ⋈ ${t})` };
    }
  });
  const dp = best['ABCD'];
  const fmtSel = (v) => v.toExponential(0);
  return (
    <Widget title="Порядок соединений: от него стоимость меняется на порядки">
      <div className="row">
        <div className="col">
          {TABLES.map((t) => <Slider key={t} label={`|${t}|, строк`} value={Math.log10(card[t])} min={0} max={7} step={0.5} format={() => fmtBig(card[t])} onChange={(v) => setCard({ ...card, [t]: Math.round(Math.pow(10, v)) })} />)}
        </div>
        <div className="col">
          {edges.map((e) => <Slider key={e} label={`селективность ${e[0]}⋈${e[1]}`} value={Math.log10(sel[e])} min={-6} max={0} step={0.5} format={() => fmtSel(sel[e])} onChange={(v) => setSel({ ...sel, [e]: Math.pow(10, v) })} />)}
        </div>
      </div>
      <div className="stats">
        <Stat k="лучший порядок (DP)" v={dp ? dp.plan : '—'} />
        <Stat k="его стоимость C_out" v={dp ? fmtBig(dp.cost) : '—'} />
        <Stat k="худший порядок / лучший" v={'×' + fmtBig(all[all.length - 1].cost / all[0].cost)} />
      </div>
      <table className="small">
        <thead><tr><th>Левоглубокий порядок</th><th>Сумма промежуточных строк</th><th></th></tr></thead>
        <tbody>{all.slice(0, 6).concat(all.slice(-3)).map((x, i) => (
          <tr key={i} style={{ fontWeight: i === 0 ? 700 : 400 }}><td className="mono">{x.p.join(' ⋈ ')}</td><td className="mono">{fmtBig(x.cost)}</td><td className="muted">{x.cross ? 'есть декартово произведение' : ''}</td></tr>
        ))}</tbody>
      </table>
      <p className="small muted">Предикаты: A–B, B–C, C–D, A–D. Размер соединения оценивается как произведение размеров таблиц и селективностей предикатов (предположение о независимости). Стоимость C_out — сумма размеров промежуточных результатов: простая, но популярная в исследованиях метрика. Показаны 6 лучших и 3 худших из 24 порядков; DP рассматривает только порядки без декартовых произведений, как System R.</p>
    </Widget>
  );
}

export default function Optimizer() {
  return (
    <>
      <h1>Оптимизатор запросов</h1>
      <p className="lead">SQL говорит, что нужно, а не как. Один и тот же запрос можно выполнить тысячами способов, и разница между лучшим и худшим — секунды против дней. Выбирает оптимизатор.</p>

      <h2>Конвейер</h2>
      <ol>
        <li><b>Разбор</b> (parser): текст → синтаксическое дерево.</li>
        <li><b>Привязка</b> (binder): имена таблиц и столбцов → объекты каталога, проверка типов и прав.</li>
        <li><b>Переписывание</b> (rewriter): правила, которые почти всегда выгодны — проталкивание фильтров вниз к таблицам, раскрытие представлений, превращение подзапросов в соединения, удаление лишних столбцов.</li>
        <li><b>Планирование по стоимости</b>: перебор вариантов (порядок соединений, алгоритмы, индексы) и выбор самого дешёвого по модели стоимости.</li>
      </ol>

      <h2>Подход System R</h2>
      <p>Селинджер и др. <Cite id="selinger1979" /> заложили основы, на которых стоят оптимизаторы PostgreSQL, DB2, Oracle и многих других:</p>
      <ul>
        <li><b>Модель стоимости</b>: оценка ввода-вывода страниц плюс взвешенная оценка работы процессора.</li>
        <li><b>Статистика</b>: число строк и страниц таблиц, число различных значений столбцов, минимумы/максимумы (позже — гистограммы).</li>
        <li><b>Динамическое программирование</b> по подмножествам таблиц: лучший план для <M t={r`\{A,B,C\}`} /> строится из лучших планов для меньших подмножеств. Рассматриваются только <b>левоглубокие</b> деревья (правый вход каждого соединения — базовая таблица) и порядки без декартовых произведений.</li>
        <li><b>Интересные порядки</b>: план, выдающий строки отсортированными по нужному ключу, может быть выгоднее, даже если сам дороже, — он избавит от сортировки выше.</li>
      </ul>
      <p>Число вариантов растёт взрывообразно: левоглубоких порядков <M t="n!" />, произвольных деревьев соединений — <M t={r`\frac{(2(n-1))!}{(n-1)!}`} />. Для 10 таблиц это 3.6 млн и 17.6 млрд. DP сокращает работу до <M t={r`O(n\,2^n)`} /> подзадач; при большом числе таблиц переходят на эвристики (в PostgreSQL при 12+ таблицах по умолчанию включается генетический оптимизатор, параметр <code>geqo_threshold</code>).</p>
      <JoinOrderWidget />

      <h2>Оценка мощности (cardinality estimation)</h2>
      <p>Чтобы сравнить планы, нужно знать, сколько строк вернёт каждый оператор. Классические формулы при отсутствии точной информации:</p>
      <Eq t={r`\mathrm{sel}(a = c) \approx \frac{1}{V(a)},\qquad \mathrm{sel}(a < c) \approx \frac{c - \min a}{\max a - \min a},\qquad |R\bowtie_{R.a=S.b}S| \approx \frac{|R|\cdot|S|}{\max(V(a), V(b))}`} />
      <p><M t="V(a)" /> — число различных значений. Два главных предположения: <b>равномерность</b> внутри столбца и <b>независимость</b> столбцов (<M t={r`\mathrm{sel}(p_1\wedge p_2) = \mathrm{sel}(p_1)\cdot\mathrm{sel}(p_2)`} />). Оба часто ложны: «город = Москва AND регион = Московская обл.» — сильно коррелированы.</p>
      <SelectivityWidget />
      <Callout type="warn" title="Насколько хороши оптимизаторы на самом деле">
        <p>Лейс и др. <Cite id="leis2015" /> построили бенчмарк JOB на реальных данных (IMDB) и показали: ошибки оценки мощности в промежуточных результатах многотабличных запросов достигают многих порядков и почти всегда в сторону <b>недооценки</b>; именно они, а не модель стоимости, — главный источник плохих планов. Неожиданный вывод — недооценка подталкивает оптимизатор к вложенным циклам, которые катастрофичны при реальном размере данных; надёжнее хеш-соединения.</p>
      </Callout>

      <h2>Что делать на практике</h2>
      <ul>
        <li><code>EXPLAIN ANALYZE</code> показывает и оценку (<code>rows=</code>), и реальность (<code>actual rows=</code>). Расхождение в 10+ раз — первый подозреваемый.</li>
        <li>Обновляйте статистику (<code>ANALYZE</code>), увеличивайте её детализацию для перекошенных столбцов (<code>ALTER TABLE … SET STATISTICS</code>), заводите многоколоночную статистику для коррелированных столбцов (<code>CREATE STATISTICS</code> в PostgreSQL).</li>
      </ul>
      <Code lang="bash" title="psql — смотрим, что думает оптимизатор">{`
EXPLAIN ANALYZE
SELECT u.city, sum(o.amount)
FROM users u JOIN orders o ON o.user_id = u.id
WHERE u.age < 30
GROUP BY u.city;

-- HashAggregate  (cost=... rows=5 ...) (actual time=... rows=5 loops=1)
--   ->  Hash Join  (cost=... rows=1180 ...) (actual ... rows=1113 ...)
--         Hash Cond: (o.user_id = u.id)
--         ->  Seq Scan on orders o  (... rows=5000 ...)
--         ->  Hash
--               ->  Seq Scan on users u  (... rows=472 ...)
--                     Filter: (age < 30)
-- (числа — иллюстрация формата; у вас будут свои)
`}</Code>
      <Quiz q="Оптимизатор оценил результат соединения в 10 строк, реально их 10 млн. Какой план, скорее всего, он выбрал и почему это плохо?" options={['Хеш-соединение — оно медленное', 'Вложенный цикл — для 10 строк он дешёв, но на 10 млн строк катастрофичен', 'Сортировку-слияние — она требует памяти', 'Ничего страшного не произойдёт']} answer={1}
        explain="Это ровно тот сценарий, который Leis и др. называют главной причиной плохих планов." />
      <Quiz q="Сколько левоглубоких порядков соединения у 5 таблиц?" options={['5', '25', '120', '1680']} answer={2}
        explain="Порядок таблиц в левоглубоком дереве — перестановка: 5! = 120. Произвольных деревьев — 8!/4! = 1680." />
    </>
  );
}
