import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Stat, Slider } from '@shared/ui.jsx';
import mvccSrc from '../python/mvcc.py?raw';

// ---------- взаимоблокировки: граф ожиданий ----------
const LOCK_SCRIPT = [
  { t: 1, k: 'A', m: 'X' }, { t: 2, k: 'B', m: 'X' }, { t: 3, k: 'C', m: 'S' },
  { t: 1, k: 'B', m: 'S' }, { t: 2, k: 'C', m: 'X' }, { t: 3, k: 'A', m: 'S' },
];
const compatible = (a, b) => a === 'S' && b === 'S';

function DeadlockWidget() {
  const [n, setN] = useState(3);
  const held = {}; const waits = []; const log = [];
  LOCK_SCRIPT.slice(0, n).forEach(({ t, k, m }) => {
    const owners = (held[k] || []).filter((h) => h.t !== t);
    const blockers = owners.filter((h) => !compatible(h.m, m));
    if (blockers.length) { blockers.forEach((b) => waits.push([t, b.t, k])); log.push(`T${t} хочет ${m}-блокировку ${k} → ЖДЁТ T${blockers.map((b) => b.t).join(',')}`); }
    else { (held[k] = held[k] || []).push({ t, m }); log.push(`T${t} получила ${m}-блокировку ${k}`); }
  });
  // поиск цикла в графе ожиданий
  const adj = {}; waits.forEach(([a, b]) => (adj[a] = [...(adj[a] || []), b]));
  let cycle = null;
  const dfs = (v, path) => { if (cycle) return; if (path.includes(v)) { cycle = path.slice(path.indexOf(v)).concat(v); return; } (adj[v] || []).forEach((w) => dfs(w, [...path, v])); };
  [1, 2, 3].forEach((v) => dfs(v, []));
  const P = { 1: [70, 40], 2: [230, 40], 3: [150, 150] };
  return (
    <Widget title="Взаимоблокировка и граф ожиданий">
      <Slider label="выполнено запросов блокировок" value={n} min={1} max={LOCK_SCRIPT.length} onChange={setN} />
      <div className="row">
        <svg viewBox="0 0 300 190" style={{ width: 300, maxWidth: '100%' }}>
          <defs><marker id="ahd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--red)" /></marker></defs>
          {waits.map(([a, b, k], i) => {
            const [x1, y1] = P[a], [x2, y2] = P[b]; const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
            return <g key={i}><line x1={x1 + (dx / L) * 24} y1={y1 + (dy / L) * 24} x2={x2 - (dx / L) * 26} y2={y2 - (dy / L) * 26} stroke="var(--red)" strokeWidth={2} markerEnd="url(#ahd)" /><text x={(x1 + x2) / 2 + 6} y={(y1 + y2) / 2 - 4} fontSize="11">{k}</text></g>;
          })}
          {[1, 2, 3].map((t) => <g key={t}><circle cx={P[t][0]} cy={P[t][1]} r={22} fill={cycle && cycle.includes(t) ? 'var(--red-soft)' : 'var(--accent-soft)'} stroke="var(--accent)" /><text x={P[t][0]} y={P[t][1] + 5} textAnchor="middle" fontWeight="700">T{t}</text></g>)}
        </svg>
        <div className="col">
          {log.map((l, i) => <div key={i} className="mono small">{i + 1}. {l}</div>)}
          <p className="small" style={{ marginTop: 8 }}>{cycle ? <b>Цикл {cycle.map((t) => 'T' + t).join(' → ')}: взаимоблокировка! СУБД выберет жертву (обычно самую «дешёвую» транзакцию) и откатит её.</b> : 'Циклов нет — все ожидания когда-нибудь разрешатся.'}</p>
        </div>
      </div>
      <p className="small muted">Ребро Tᵢ → Tⱼ означает «Tᵢ ждёт блокировку, которую держит Tⱼ». S-блокировки (чтение) совместимы между собой, X (запись) — ни с чем. PostgreSQL ищет циклы, если ожидание длится дольше <code>deadlock_timeout</code> (по умолчанию 1 с).</p>
    </Widget>
  );
}

// ---------- видимость версий в MVCC (в стиле PostgreSQL) ----------
const CHAIN = [
  { v: "balance = 100", xmin: 90, xmax: 105 },
  { v: "balance = 70", xmin: 105, xmax: 112 },
  { v: "balance = 20", xmin: 112, xmax: null },
];
function MVCCWidget() {
  const [committed, setCommitted] = useState({ 90: true, 105: true, 112: false });
  const [snapXmax, setSnapXmax] = useState(110);
  const [active112, setActive112] = useState(true);
  // снимок: всё с xid < snapXmax и не активное в момент снимка считается видимым, если зафиксировано
  const activeAtSnap = new Set(active112 && snapXmax > 112 ? [112] : []);
  const sees = (xid) => xid !== null && xid < snapXmax && !activeAtSnap.has(xid) && committed[xid];
  const vis = CHAIN.map((c) => sees(c.xmin) && !(c.xmax !== null && sees(c.xmax)));
  return (
    <Widget title="MVCC: какую версию строки видит снимок">
      <div className="controls">
        <Slider label="снимок взят, когда следующий xid был" value={snapXmax} min={91} max={120} onChange={setSnapXmax} />
        {[105, 112].map((x) => <label key={x} className="small"><input type="checkbox" checked={committed[x]} onChange={() => setCommitted({ ...committed, [x]: !committed[x] })} /> T{x} зафиксирована</label>)}
        <label className="small"><input type="checkbox" checked={active112} onChange={() => setActive112(!active112)} /> T112 была активна в момент снимка</label>
      </div>
      <table>
        <thead><tr><th>Версия</th><th>xmin (создала)</th><th>xmax (заменила)</th><th>видна снимку?</th></tr></thead>
        <tbody>{CHAIN.map((c, i) => (
          <tr key={i} style={{ background: vis[i] ? 'var(--green-soft)' : undefined }}>
            <td className="mono">{c.v}</td>
            <td>T{c.xmin} {committed[c.xmin] ? '✓' : '(не зафиксирована)'}</td>
            <td>{c.xmax ? `T${c.xmax} ${committed[c.xmax] ? '✓' : '(не зафиксирована)'}` : '—'}</td>
            <td><b>{vis[i] ? 'ДА' : 'нет'}</b></td>
          </tr>
        ))}</tbody>
      </table>
      <p className="small muted">Правило: версия видна, если её создатель (xmin) зафиксирован и «старше» снимка, а заменившая транзакция (xmax) — нет. Ровно одна версия цепочки видна любому снимку (или ни одной, если строка ещё не существовала). Транзакции, активные в момент снимка, считаются невидимыми, даже если зафиксируются позже — снимок не «плывёт».</p>
    </Widget>
  );
}

export default function Concurrency() {
  return (
    <>
      <h1>Блокировки и MVCC</h1>
      <p className="lead">Как обеспечить изоляцию, не выполняя транзакции по одной. Два больших семейства: пессимистичное (блокировки) и многоверсионное (снимки). Современные СУБД обычно сочетают оба.</p>

      <h2>Двухфазная блокировка (2PL)</h2>
      <p>Каждый объект защищается блокировкой: <b>S</b> (shared) для чтения, <b>X</b> (exclusive) для записи. Совместимы только S с S.</p>
      <table style={{ maxWidth: 320 }}><thead><tr><th></th><th>S</th><th>X</th></tr></thead><tbody><tr><th>S</th><td>✓</td><td>✗</td></tr><tr><th>X</th><td>✗</td><td>✗</td></tr></tbody></table>
      <p>
        Протокол 2PL <Cite id="eswaran1976" />: у транзакции есть фаза <b>роста</b> (только берёт блокировки) и фаза <b>сжатия</b> (только отпускает). Теорема: любое расписание, порождённое 2PL, конфликтно сериализуемо.
        На практике используют <b>строгую 2PL</b> — все блокировки отпускаются только при фиксации/откате. Иначе другие транзакции могли бы прочитать незафиксированные данные и при откате пришлось бы откатывать каскадом.
      </p>
      <ul>
        <li><b>Фантомы</b>: блокировки строк не мешают вставить новую строку, подходящую под условие. Нужны предикатные блокировки <Cite id="eswaran1976" /> или их практичная замена — блокировки диапазонов ключей индекса (next-key locks в InnoDB).</li>
        <li><b>Гранулярность</b>: блокировать всю таблицу дёшево, но убивает параллелизм; каждую строку — дорого по памяти. Иерархические блокировки с «намерениями» (IS, IX) позволяют брать блокировки на разных уровнях согласованно.</li>
      </ul>
      <h3>Взаимоблокировки</h3>
      <p>Две транзакции ждут друг друга — тупик. Решения: <b>обнаружение</b> (искать циклы в графе ожиданий и откатывать жертву), <b>предотвращение</b> (wait-die / wound-wait по временным меткам), <b>тайм-ауты</b>.</p>
      <DeadlockWidget />

      <h2>Многоверсионность (MVCC)</h2>
      <p>
        Главная беда блокировок — читатели и писатели мешают друг другу: долгий отчёт блокирует обновления. Идея MVCC <Cite id="bernstein1983" />: при изменении строки не перезаписывать её, а создавать <b>новую версию</b>.
        Каждая транзакция читает снимок — версии, существовавшие на момент её начала. <b>Читатели не блокируют писателей, писатели — читателей.</b> MVCC используют PostgreSQL, Oracle, MySQL/InnoDB, SQL Server (в режиме snapshot), CockroachDB и почти все новые СУБД.
      </p>
      <MVCCWidget />
      <h3>Где хранить версии</h3>
      <p>Ву и др. <Cite id="wu2017" /> систематически сравнили варианты проектирования MVCC:</p>
      <ul>
        <li><b>Append-only</b> (PostgreSQL): новая версия — новая строка в той же таблице; старые версии остаются, пока их не удалит <code>VACUUM</code>. Простота, но таблицы «пухнут», и все индексы приходится обновлять (смягчается HOT-обновлениями).</li>
        <li><b>Delta / undo-лог</b> (Oracle, InnoDB): в таблице — последняя версия, а старые восстанавливаются из сегмента отката. Таблица компактна, но долгие транзакции читают длинные цепочки отката.</li>
        <li><b>Сборка мусора</b> обязательна в любом варианте: версии, которые не может увидеть ни один активный снимок, нужно удалять. Одна забытая открытая транзакция мешает очистке всей базы.</li>
      </ul>

      <h2>Оптимистичный контроль и SSI</h2>
      <p>
        Кунг и Робинсон <Cite id="kung1981" /> предложили <b>оптимистичный</b> подход (OCC): выполнять транзакцию без блокировок, а при фиксации проверить, не изменил ли кто-то прочитанное, — и откатить, если да. Выгодно при редких конфликтах.
      </p>
      <p>
        Snapshot isolation допускает write skew (глава 11). Кэхилл, Рём и Фекете <Cite id="cahill2008" /> доказали, что любой не сериализуемый цикл при SI содержит две подряд «опасные» rw-зависимости (транзакция прочитала то, что другая параллельно записала), и предложили
        <b> Serializable Snapshot Isolation</b>: отслеживать такие зависимости и откатывать транзакцию, когда появляется опасная структура. SSI реализован в PostgreSQL 9.1 как уровень <code>SERIALIZABLE</code> <Cite id="ports2012" />.
      </p>

      <h2>Реализация</h2>
      <Code title="books/db/python/mvcc.py" collapse>{mvccSrc}</Code>
      <Code lang="bash" title="вывод python mvcc.py">{`
1) Снимок: читатель не видит изменений, зафиксированных после его старта
   читатель видит 100, новая транзакция видит 50
2) Потерянное обновление: две транзакции делают balance += 10
    T3: конфликт записи по «balance» (first-committer-wins) → приложение повторяет T2 с новым снимком
   итог: 120 (без проверки конфликта T2 затёрла бы T1, и было бы 110)
3) Write skew: каждый проверяет «дежурят двое» и снимает с дежурства себя
   SNAPSHOT    : дежурит врачей: 0  ← инвариант нарушен (write skew)
    T3: прочитанный ключ «alice_on_call» изменён параллельной транзакцией
   SERIALIZABLE: дежурит врачей: 1  ✓
`}</Code>
      <Quiz q="Долгая транзакция открыта 6 часов (кто-то забыл COMMIT в psql). Чем это плохо в PostgreSQL, даже если она ничего не блокирует?" options={['Ничем', 'VACUUM не может удалить версии строк, которые эта транзакция ещё может видеть, — таблицы и индексы раздуваются', 'Она займёт все соединения', 'PostgreSQL её автоматически откатит']} answer={1}
        explain="Горизонт видимости определяется самым старым активным снимком. Поэтому idle in transaction — частая причина «распухания» баз." />
      <Quiz q="Чем строгая 2PL отличается от обычной?" options={['Использует только X-блокировки', 'Отпускает блокировки только при фиксации или откате — нет каскадных откатов', 'Не допускает взаимоблокировок', 'Блокирует всю таблицу']} answer={1}
        explain="Обычная 2PL может отпустить блокировку раньше, и другие прочитают незафиксированные изменения. Строгая гарантирует восстанавливаемость." />
    </>
  );
}
