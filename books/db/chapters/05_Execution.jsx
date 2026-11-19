import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt, fmtBig } from '@shared/ui.jsx';
import querySrc from '../python/query.py?raw';

// Пошаговая трасса модели итераторов: Limit(2) ← Filter(age<30) ← Scan(users)
const USERS = [['Аня', 25], ['Борис', 41], ['Вера', 29], ['Глеб', 35], ['Даша', 22], ['Егор', 19]];
function buildTrace() {
  const ev = [];
  let out = 0, i = 0;
  ev.push(['Limit', 'next()', 'клиент просит первую строку']);
  while (out < 2) {
    ev.push(['Filter', 'next()', 'Limit просит строку у Filter']);
    let found = false;
    while (!found) {
      ev.push(['Scan', 'next()', 'Filter просит строку у Scan']);
      const [n, a] = USERS[i++];
      ev.push(['Scan', `→ (${n}, ${a})`, 'Scan читает очередную строку со страницы']);
      if (a < 30) { found = true; ev.push(['Filter', `→ (${n}, ${a})`, `${a} < 30 — подходит, отдаём наверх`]); }
      else ev.push(['Filter', '✗', `${a} ≥ 30 — отбрасываем, просим следующую`]);
    }
    out++;
    ev.push(['Limit', `→ строка ${out}`, out < 2 ? 'Limit отдаёт строку клиенту; клиент просит ещё' : 'вторая строка — лимит исчерпан']);
  }
  ev.push(['Limit', 'конец', `Scan прочитал только ${i} из ${USERS.length} строк — остальные не понадобились`]);
  return ev;
}

function VolcanoWidget() {
  const trace = useMemo(buildTrace, []);
  const [step, setStep] = useState(1);
  const cur = trace[step - 1];
  const ops = ['Limit', 'Filter', 'Scan'];
  return (
    <Widget title="Модель итераторов: строки «тянутся» сверху вниз по одной">
      <div className="row">
        <div style={{ flex: '0 0 230px' }}>
          <svg viewBox="0 0 220 230" className="diagram">
            {ops.map((o, i) => (
              <g key={o}>
                <rect x={30} y={10 + i * 75} width={160} height={46} rx={8} className={'box ' + (cur[0] === o ? 'hl3' : 'hl')} />
                <text x={110} y={30 + i * 75} textAnchor="middle" fontWeight="600">{o === 'Limit' ? 'Limit 2' : o === 'Filter' ? 'Filter age < 30' : 'Seq Scan users'}</text>
                <text x={110} y={47 + i * 75} textAnchor="middle" className="sm">{cur[0] === o ? cur[1] : ''}</text>
                {i < 2 && <line x1={110} y1={56 + i * 75} x2={110} y2={85 + i * 75} stroke="var(--muted)" />}
              </g>
            ))}
          </svg>
        </div>
        <div className="col">
          <div className="controls">
            <button className="btn" onClick={() => setStep(Math.max(1, step - 1))}>← назад</button>
            <button className="btn primary" onClick={() => setStep(Math.min(trace.length, step + 1))}>шаг →</button>
            <span className="small muted">шаг {step}/{trace.length}</span>
          </div>
          <p><b>{cur[0]}</b>: <span className="mono">{cur[1]}</span></p>
          <p className="small">{cur[2]}</p>
          <table className="small"><tbody>{USERS.map(([n, a], j) => <tr key={j}><td>{n}</td><td>{a}</td></tr>)}</tbody></table>
        </div>
      </div>
    </Widget>
  );
}

function JoinCost() {
  const [Mp, setM] = useState(1000);
  const [Np, setN] = useState(500);
  const [B, setB] = useState(100);
  const [rpp, setRpp] = useState(100);
  const log = (x, b) => Math.log(x) / Math.log(b);
  const sortCost = (P) => 2 * P * (1 + Math.max(0, Math.ceil(log(Math.ceil(P / B), B - 1))));
  const costs = [
    ['Простой вложенный цикл (по строкам)', Mp + Mp * rpp * Np, 'M + (строк в R)·N'],
    ['Блочный вложенный цикл', Mp + Math.ceil(Mp / (B - 2)) * Np, 'M + ⌈M/(B−2)⌉·N'],
    ['Сортировка-слияние', sortCost(Mp) + sortCost(Np) + Mp + Np, 'сорт.(R) + сорт.(S) + M + N'],
    ['Хеш-соединение (Grace)', Math.min(Mp, Np) <= B - 2 ? Mp + Np : 3 * (Mp + Np), Math.min(Mp, Np) <= B - 2 ? 'M + N (меньшая таблица в памяти)' : '3(M + N): разбить, записать, прочитать'],
  ];
  const best = Math.min(...costs.map((c) => c[1]));
  return (
    <Widget title="Стоимость соединения R ⋈ S в страницах ввода-вывода">
      <div className="controls">
        <Slider label="M — страниц в R" value={Mp} min={10} max={10000} step={10} onChange={setM} />
        <Slider label="N — страниц в S" value={Np} min={10} max={10000} step={10} onChange={setN} />
        <Slider label="B — страниц буфера" value={B} min={3} max={2000} onChange={setB} />
        <Slider label="строк на страницу R" value={rpp} min={1} max={200} onChange={setRpp} />
      </div>
      <table>
        <thead><tr><th>Алгоритм</th><th>Формула</th><th>Чтений/записей страниц</th><th>При 0.1 мс/стр.</th></tr></thead>
        <tbody>{costs.map(([n, c, f]) => (
          <tr key={n} style={{ fontWeight: c === best ? 700 : 400 }}><td>{n}{c === best ? ' ✓' : ''}</td><td className="mono small">{f}</td><td className="mono">{fmtBig(c)}</td><td>{c * 1e-4 < 60 ? fmt(c * 1e-4, 1) + ' с' : c * 1e-4 < 3600 ? fmt(c * 1e-4 / 60, 1) + ' мин' : fmt(c * 1e-4 / 3600, 1) + ' ч'}</td></tr>
        ))}</tbody>
      </table>
      <p className="small muted">Классические формулы из учебников (стоимость в страницах, без записи результата; формула сортировки — внешняя сортировка слиянием). Уменьшайте B: блочный цикл и сортировка деградируют. Если меньшая таблица помещается в память, хеш-соединение читает каждую таблицу один раз.</p>
    </Widget>
  );
}

export default function Execution() {
  return (
    <>
      <h1>Выполнение запросов</h1>
      <p className="lead">Оптимизатор превращает SQL в план — дерево операторов. Исполнитель выполняет это дерево. Разберём, как устроены операторы и как они передают друг другу строки.</p>

      <h2>Реляционная алгебра</h2>
      <p>Кодд <Cite id="codd1970" /> описал запросы как композицию операций над отношениями (таблицами):</p>
      <table>
        <tbody>
          <tr><td><M t={r`\sigma_{p}(R)`} /></td><td>выборка (selection) — строки, удовлетворяющие условию: <code>WHERE</code></td></tr>
          <tr><td><M t={r`\pi_{a,b}(R)`} /></td><td>проекция — столбцы: <code>SELECT a, b</code></td></tr>
          <tr><td><M t={r`R\bowtie_{R.x=S.y}S`} /></td><td>соединение: <code>JOIN … ON</code></td></tr>
          <tr><td><M t={r`\gamma_{g;\,\mathrm{sum}(v)}(R)`} /></td><td>группировка и агрегация: <code>GROUP BY</code></td></tr>
          <tr><td><M t={r`\tau_{a}(R)`} /></td><td>сортировка: <code>ORDER BY</code></td></tr>
        </tbody>
      </table>
      <p>Запрос <code>SELECT u.city, sum(o.amount) FROM users u JOIN orders o ON o.user_id = u.id WHERE u.age &lt; 30 GROUP BY u.city</code> — это</p>
      <Eq t={r`\gamma_{city;\,\mathrm{sum}(amount)}\big(\text{orders}\bowtie_{user\_id=id}\sigma_{age<30}(\text{users})\big)`} />
      <p>Одно и то же выражение можно переписать множеством эквивалентных способов (например, выполнить фильтр до или после соединения). Выбор лучшего — работа оптимизатора (глава 6).</p>

      <h2>Модель итераторов (Volcano)</h2>
      <p>
        Графе <Cite id="graefe1994" /> описал модель, которой следует большинство СУБД: каждый оператор — итератор с методами <code>open()</code>, <code>next()</code>, <code>close()</code>.
        <code>next()</code> возвращает одну строку; оператор получает строки, вызывая <code>next()</code> у детей. Строки «текут» по плану снизу вверх, а управление — сверху вниз.
      </p>
      <VolcanoWidget />
      <ul>
        <li><b>Конвейерность (pipelining):</b> Filter и Project не хранят строки — передают их дальше сразу. <code>LIMIT</code> останавливает весь конвейер.</li>
        <li><b>Блокирующие операторы:</b> Sort, построение хеш-таблицы, агрегация должны прочитать вход целиком, прежде чем выдать первую строку.</li>
        <li><b>Цена:</b> один виртуальный вызов функции на строку на оператор. Для OLTP это неважно, для аналитики по миллиардам строк — критично.</li>
      </ul>
      <Callout type="note" title="Векторизация и компиляция">
        <p>MonetDB/X100 <Cite id="boncz2005" /> предложил передавать между операторами не строку, а <b>вектор</b> из ~1000 значений столбца: накладные расходы делятся на 1000, а цикл по массиву хорошо ложится на конвейер процессора и SIMD (так работают DuckDB, ClickHouse, Velox). Нойманн <Cite id="neumann2011" /> пошёл другим путём: компилировать план в машинный код, «сплавляя» конвейер операторов в один цикл (HyPer, Umbra; JIT-выражения в PostgreSQL — частичный вариант).</p>
      </Callout>

      <h2>Алгоритмы соединения</h2>
      <p>Соединение — самая дорогая операция в большинстве запросов. Обзор классических алгоритмов — у Графе <Cite id="graefe1993" />.</p>
      <ul>
        <li><b>Вложенный цикл</b>: для каждой строки <M t="R" /> перебрать все строки <M t="S" />. <M t={r`O(|R|\cdot|S|)`} />. Блочный вариант загружает в память сразу <M t="B-2" /> страниц <M t="R" />. <b>Индексный</b> вложенный цикл ищет совпадения для каждой строки <M t="R" /> по индексу на <M t="S" /> — отлично, когда строк в <M t="R" /> мало.</li>
        <li><b>Хеш-соединение</b>: построить хеш-таблицу по меньшей стороне (build), пройти по большей и искать совпадения (probe). <M t={r`O(|R|+|S|)`} />. Если не помещается в память — <b>Grace hash join</b>: сначала разбить обе таблицы одной хеш-функцией на части, которые помещаются, и соединять части попарно. Работает только для равенства.</li>
        <li><b>Сортировка-слияние</b>: отсортировать обе стороны по ключу и пройти двумя указателями. Выгодно, если данные уже отсортированы (есть индекс) или результат нужен отсортированным; работает и для неравенств.</li>
      </ul>
      <JoinCost />

      <h2>Реализация</h2>
      <p>Исполнитель с девятью операторами в модели итераторов. Каждый оператор — Python-генератор: <code>for row in child</code> вызывает <code>next()</code> у ребёнка.</p>
      <Code title="books/db/python/query.py" collapse>{querySrc}</Code>
      <Code lang="bash" title="вывод python query.py">{`
-> Limit 3
  -> Sort by total DESC
    -> HashAggregate by users.city: count(orders.id), sum(orders.amount)
      -> Hash Join on orders.user_id = users.id
        -> Seq Scan on orders (5000 строк)
        -> Filter: users.age < 30
          -> Seq Scan on users (2000 строк)
NestedLoopJoin : сравнений/поисков ключа 2,280,000
HashJoin       : сравнений/поисков ключа     5,000
SortMergeJoin  : сравнений/поисков ключа     5,023
все три алгоритма соединения дали одинаковый результат ✓
`}</Code>
      <p className="small muted">Обратите внимание, как <code>EXPLAIN</code> в PostgreSQL выводит планы почти в том же виде: <code>-&gt; Hash Join</code>, <code>-&gt; Seq Scan</code>. Попробуйте <code>EXPLAIN ANALYZE</code> на своей базе и сопоставьте операторы с этой главой.</p>
      <Quiz q="Какой оператор блокирующий — не может выдать первую строку, пока не прочитает весь вход?" options={['Filter', 'Project', 'Sort', 'Limit']} answer={2}
        explain="Самая маленькая строка может оказаться последней во входе — Sort обязан прочитать всё." />
      <Quiz q="Таблица R — 10 строк, у S есть индекс по ключу соединения, в S — 100 млн строк. Лучший алгоритм:" options={['хеш-соединение', 'сортировка-слияние', 'индексный вложенный цикл', 'простой вложенный цикл без индекса']} answer={2}
        explain="10 поисков по индексу ≈ 10·4 чтения страниц. Хеш и сортировка прочитали бы все 100 млн строк S." />
    </>
  );
}
