import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt, fmtBig } from '@shared/ui.jsx';
import { makeRng } from '@shared/rng.js';
import extSrc from '../python/extsort.py?raw';

function buildStages(data, mem, k) {
  const stages = [];
  const runs = [];
  for (let i = 0; i < data.length; i += mem) runs.push([...data.slice(i, i + mem)].sort((a, b) => a - b));
  stages.push({ title: `Проход 0: прогоны по ${mem} записей (столько помещается в память), каждый отсортирован в памяти`, runs });
  let cur = runs, p = 1;
  while (cur.length > 1) {
    const next = [];
    for (let i = 0; i < cur.length; i += k) next.push(cur.slice(i, i + k).flat().sort((a, b) => a - b));
    stages.push({ title: `Проход ${p}: сливаем по ${k} прогона (k-путевое слияние)`, runs: next });
    cur = next; p++;
  }
  return stages;
}

function ExtSortWidget() {
  const [mem, setMem] = useState(4);
  const [k, setK] = useState(2);
  const data = useMemo(() => { const rng = makeRng(12); return Array.from({ length: 24 }, () => 10 + Math.floor(rng.rand() * 90)); }, []);
  const stages = useMemo(() => buildStages(data, mem, k), [data, mem, k]);
  const [s, setS] = useState(0);
  const st = stages[Math.min(s, stages.length - 1)];
  const colors = ['#d0ebff', '#ffe8cc', '#d3f9d8', '#f3d9fa', '#fff3bf', '#ffe3e3', '#c5f6fa', '#e5dbff'];
  return (
    <Widget title="Внешняя сортировка слиянием шаг за шагом">
      <div className="controls">
        <Slider label="памяти, записей" value={mem} min={2} max={12} onChange={(v) => { setMem(v); setS(0); }} />
        <Slider label="k — прогонов за одно слияние" value={k} min={2} max={6} onChange={(v) => { setK(v); setS(0); }} />
      </div>
      <p className="mono small">вход: {data.join(' ')}</p>
      <div className="controls">
        <button className="btn" onClick={() => setS(Math.max(0, s - 1))}>← назад</button>
        <button className="btn primary" onClick={() => setS(Math.min(stages.length - 1, s + 1))}>следующий проход →</button>
        <span className="small muted">{Math.min(s, stages.length - 1) + 1} / {stages.length}</span>
      </div>
      <p className="small"><b>{st.title}</b></p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {st.runs.map((run, i) => <div key={i} className="mono small" style={{ padding: '4px 8px', borderRadius: 6, background: colors[i % colors.length], color: '#222' }}>{run.join(' ')}</div>)}
      </div>
      <div className="stats">
        <Stat k="прогонов после прохода 0" v={stages[0].runs.length} />
        <Stat k="проходов всего" v={stages.length} />
        <Stat k="⌈log_k(прогонов)⌉ + 1" v={1 + Math.ceil(Math.log(stages[0].runs.length) / Math.log(k) - 1e-9)} />
      </div>
      <p className="small muted">Каждый проход читает и записывает все данные. Больше памяти — длиннее прогоны и их меньше; больше k — меньше проходов слияния.</p>
    </Widget>
  );
}

function CostWidget() {
  const [logN, setLogN] = useState(6);
  const [B, setB] = useState(1000);
  const [rs, setRs] = useState(false);
  const N = Math.round(Math.pow(10, logN));
  const runLen = rs ? 2 * B : B;
  const runs = Math.ceil(N / runLen);
  const passes = 1 + (runs > 1 ? Math.ceil(Math.log(runs) / Math.log(B - 1) - 1e-12) : 0);
  const io = 2 * N * passes;
  return (
    <Widget title="Стоимость внешней сортировки">
      <div className="controls">
        <Slider label="страниц данных N = 10^" value={logN} min={2} max={10} step={0.5} onChange={setLogN} format={() => fmtBig(N)} />
        <Slider label="B — страниц памяти" value={B} min={3} max={100000} onChange={setB} />
        <label className="small"><input type="checkbox" checked={rs} onChange={() => setRs(!rs)} /> замещающий выбор (прогоны ≈ 2B)</label>
      </div>
      <div className="stats">
        <Stat k="прогонов" v={fmtBig(runs)} />
        <Stat k="проходов" v={passes} />
        <Stat k="ввод-вывод, страниц" v={fmtBig(io)} />
        <Stat k="при 8 КБ стр. и 1 ГБ/с" v={fmt((io * 8192) / 1e9, 1) + ' с'} />
      </div>
      <p className="small muted">Два прохода возможны, пока прогонов не больше B − 1, то есть N ≤ B(B − 1). При 8-КБ страницах 1000 страниц памяти (8 МБ) сортируют за 2 прохода до ~1 млн страниц (8 ГБ), а 100 000 страниц (800 МБ) — до ~10 млрд страниц (80 ТБ). Поэтому на практике почти любая сортировка — 2 прохода: «прочитать и записать данные дважды».</p>
    </Widget>
  );
}

export default function ExternalSort() {
  return (
    <>
      <h1>Внешняя сортировка</h1>
      <p className="lead">ORDER BY, CREATE INDEX, сортировка-слияние, GROUP BY, DISTINCT — всем нужна сортировка, а данных бывает в тысячи раз больше, чем памяти. Решение — сортировка слиянием, приспособленная к диску.</p>

      <h2>Почему не quicksort</h2>
      <p>
        Быстрая сортировка обращается к элементам в непредсказуемом порядке; если массив на диске, каждое обращение может стоить случайного чтения. Внешняя сортировка устроена так, чтобы данные читались и писались
        <b> только последовательно и большими блоками</b>, а число полных проходов по данным было минимальным. Классические и современные приёмы собраны в обзоре Графе <Cite id="graefe2006" />.
      </p>

      <h2>Алгоритм</h2>
      <ol>
        <li><b>Генерация прогонов.</b> Читаем столько данных, сколько помещается в память (<M t="B" /> страниц), сортируем в памяти, записываем отсортированный <b>прогон</b>. Получается <M t={r`\lceil N/B\rceil`} /> прогонов.</li>
        <li><b>Слияние.</b> Держим в памяти по одной странице от каждого из <M t="k" /> прогонов и страницу для вывода; на каждом шаге выбираем минимальный элемент среди голов прогонов (через кучу — <M t={r`O(\log k)`} />). <M t={r`k \le B-1`} />. Если прогонов больше <M t="k" /> — повторяем проходами.</li>
      </ol>
      <Eq t={r`\text{проходов} = 1 + \Big\lceil\log_{B-1}\Big\lceil\frac{N}{B}\Big\rceil\Big\rceil,\qquad \text{ввод-вывод} = 2N\cdot\text{проходов}`} />
      <ExtSortWidget />
      <CostWidget />

      <h2>Оптимизации</h2>
      <ul>
        <li><b>Замещающий выбор</b> (replacement selection, описан у Кнута): вместо «прочитать порцию и отсортировать» держим кучу; выводим минимум, на его место читаем следующий элемент; если он меньше уже выведенного — он ждёт следующего прогона. На случайных данных прогоны в среднем вдвое длиннее памяти, на почти отсортированных — намного длиннее.</li>
        <li><b>Двойная буферизация</b>: пока процессор сливает одни страницы, диск уже читает следующие.</li>
        <li><b>Top-N сортировка</b>: для <code>ORDER BY … LIMIT 10</code> не нужно сортировать всё — достаточно кучи из 10 элементов. PostgreSQL показывает это как <code>Sort Method: top-N heapsort</code>.</li>
        <li><b>Сортировка не нужна вовсе</b>, если есть B+-дерево по нужному ключу (глава 6): листья уже упорядочены. Но для некластерного индекса чтение строк в порядке индекса — случайный доступ, и сортировка таблицы часто дешевле.</li>
        <li><b>Сортировка или хеширование.</b> GROUP BY и DISTINCT можно делать и сортировкой, и хеш-таблицей; при нехватке памяти хеш-агрегация тоже разбивает данные на части на диске — это зеркальный алгоритм (Graefe <Cite id="graefe1993" />).</li>
      </ul>
      <Code lang="bash" title="psql — как увидеть внешнюю сортировку">{`
SET work_mem = '4MB';           -- память на одну операцию сортировки/хеширования
EXPLAIN ANALYZE SELECT * FROM big ORDER BY payload;
--   Sort Method: external merge  Disk: 120000kB    ← не поместилось: прогоны на диске
SET work_mem = '512MB';
EXPLAIN ANALYZE SELECT * FROM big ORDER BY payload;
--   Sort Method: quicksort  Memory: 350000kB       ← всё в памяти
EXPLAIN ANALYZE SELECT * FROM big ORDER BY payload LIMIT 10;
--   Sort Method: top-N heapsort  Memory: 26kB
-- (размеры — иллюстрация формата)
`}</Code>

      <h2>Реализация</h2>
      <Code title="books/db/python/extsort.py" collapse>{extSrc}</Code>
      <Code lang="bash" title="вывод python extsort.py">{`
простые прогоны  : прогонов  100 (средняя длина    2000), проходов слияния 3, чтений+записей 1,600,000 (формула 2N·(1+⌈log_k прогонов⌉) = 1,600,000)
замещающий выбор : прогонов   51 (средняя длина    3922), проходов слияния 2, чтений+записей 1,200,000 (формула 2N·(1+⌈log_k прогонов⌉) = 1,200,000)
результат совпадает с sorted() ✓
`}</Code>
      <p className="small muted">Подсчёт реальных чтений и записей совпал с формулой до единицы. Замещающий выбор дал прогоны в 1.96 раза длиннее памяти — и сэкономил целый проход слияния.</p>
      <Quiz q="Данных 10 000 страниц, памяти 100 страниц. Сколько проходов сделает внешняя сортировка слиянием?" options={['1', '2', '3', '100']} answer={2}
        explain="Проход 0 даёт ⌈10 000/100⌉ = 100 прогонов. За один проход сливается не больше B − 1 = 99 прогонов — на один меньше, чем нужно! Поэтому 1 + ⌈log₉₉ 100⌉ = 1 + 2 = 3 прохода. Будь памяти 101 страница, хватило бы двух." />
      <Quiz q="Почему для ORDER BY … LIMIT 10 СУБД не сортирует всю таблицу?" options={['Это запрещено SQL', 'Достаточно поддерживать кучу из 10 лучших элементов за один проход — O(N log 10)', 'LIMIT применяется до ORDER BY', 'Сортирует, просто быстрее']} answer={1}
        explain="Top-N heapsort: память O(10), один проход по данным." />
    </>
  );
}
