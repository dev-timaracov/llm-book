import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt, fmtBig } from '@shared/ui.jsx';
import { BPTree } from '../lib/bptree.js';
import { makeRng } from '@shared/rng.js';
import btreeSrc from '../python/btree.py?raw';

function TreeView({ tree, highlight }) {
  const levels = tree.levels();
  const KW = 24, PAD = 6, GAP = 10, LH = 70;
  const nodeW = (n) => Math.max(1, n.keys.length) * KW + PAD * 2;
  // раскладка: листья подряд, родители — по центру над детьми
  const pos = new Map();
  const leaves = levels[levels.length - 1];
  let x = 10;
  leaves.forEach((n) => { pos.set(n.id, { x, w: nodeW(n) }); x += nodeW(n) + GAP; });
  for (let d = levels.length - 2; d >= 0; d--) {
    levels[d].forEach((n) => {
      const a = pos.get(n.children[0].id), b = pos.get(n.children[n.children.length - 1].id);
      const w = nodeW(n), cx = (a.x + b.x + b.w) / 2;
      pos.set(n.id, { x: cx - w / 2, w });
    });
  }
  const W = Math.max(x, 300), H = levels.length * LH + 10;
  const hl = new Set(highlight || []);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: Math.max(W, 300), maxWidth: 'none', height: 'auto', minWidth: '100%' }}>
        {levels.map((lvl, d) => lvl.map((n) => !n.leaf && n.children.map((c, j) => {
          const p = pos.get(n.id), q = pos.get(c.id);
          const px = p.x + PAD + j * KW, py = 10 + d * LH + 30;
          return <line key={n.id + '-' + c.id} x1={px} y1={py} x2={q.x + q.w / 2} y2={10 + (d + 1) * LH} stroke={hl.has(c.id) && hl.has(n.id) ? 'var(--amber)' : 'var(--border)'} strokeWidth={hl.has(c.id) && hl.has(n.id) ? 2.5 : 1} />;
        })))}
        {leaves.map((n) => n.next && (() => { const p = pos.get(n.id), q = pos.get(n.next.id); const y = 10 + (levels.length - 1) * LH + 15; return <line key={'nx' + n.id} x1={p.x + p.w} y1={y} x2={q.x} y2={y} stroke="var(--green)" strokeDasharray="2 2" />; })())}
        {levels.map((lvl, d) => lvl.map((n) => {
          const p = pos.get(n.id), y = 10 + d * LH;
          return (
            <g key={n.id}>
              <rect x={p.x} y={y} width={p.w} height={30} rx={5} fill={hl.has(n.id) ? 'var(--amber-soft)' : n.leaf ? 'var(--green-soft)' : 'var(--accent-soft)'} stroke={hl.has(n.id) ? 'var(--amber)' : n.leaf ? 'var(--green)' : 'var(--accent)'} />
              {n.keys.map((k, i) => <text key={i} x={p.x + PAD + i * KW + KW / 2} y={y + 20} textAnchor="middle" fontSize="12" className="mono">{k}</text>)}
            </g>
          );
        }))}
      </svg>
    </div>
  );
}

function BTreeWidget() {
  const [order, setOrder] = useState(4);
  const [ops, setOps] = useState([]);
  const [input, setInput] = useState('42');
  const [search, setSearch] = useState(null);
  const tree = useMemo(() => { const t = new BPTree(order); ops.forEach((k) => t.insert(k)); return t; }, [ops, order]);
  const rng = useMemo(() => makeRng(7), []);
  const add = (k) => { if (Number.isFinite(k)) { setOps([...ops, k]); setSearch(null); } };
  const path = search !== null ? tree.path(search) : null;
  return (
    <Widget title="B+-дерево: вставка, деление узлов, поиск">
      <div className="controls">
        <Slider label="порядок (макс. детей узла)" value={order} min={3} max={7} onChange={setOrder} />
        <input type="number" value={input} onChange={(e) => setInput(e.target.value)} style={{ width: 80 }} />
        <button className="btn primary" onClick={() => add(parseInt(input, 10))}>вставить</button>
        <button className="btn" onClick={() => setSearch(parseInt(input, 10))}>найти</button>
        <button className="btn" onClick={() => setOps([...ops, ...Array.from({ length: 5 }, () => Math.floor(rng.rand() * 100))])}>+5 случайных</button>
        <button className="btn" onClick={() => setOps([...ops, ...Array.from({ length: 5 }, (_, i) => (ops.length ? Math.max(...ops) : 0) + i + 1)])}>+5 по возрастанию</button>
        <button className="btn" onClick={() => { setOps([]); setSearch(null); }}>очистить</button>
      </div>
      <TreeView tree={tree} highlight={path} />
      <div className="stats">
        <Stat k="ключей" v={new Set(ops).size} /><Stat k="высота" v={tree.levels().length} /><Stat k="делений узлов" v={tree.splits} />
        {search !== null && <Stat k={`поиск ${search}`} v={`${tree.has(search) ? 'найден' : 'нет'} за ${path.length} чтений`} />}
      </div>
      <p className="small muted">Синие — внутренние узлы (только разделители), зелёные — листья (ключи и ссылки на строки), пунктир — связь соседних листьев. Узел, в котором ключей стало слишком много, делится пополам, и разделитель уходит к родителю; если делится корень, дерево растёт на уровень <b>вверх</b> — поэтому все листья всегда на одной глубине. Вставка по возрастанию (как у автоинкрементных id) оставляет листья наполовину пустыми; настоящие СУБД для этого делят «правый край» не пополам.</p>
    </Widget>
  );
}

function FanoutCalc() {
  const [page, setPage] = useState(8192);
  const [keySize, setKeySize] = useState(8);
  const [rows, setRows] = useState(9);
  const ptr = 6, overhead = 0.7; // указатель на страницу; средняя заполненность ~70%
  const fanout = Math.floor(((page / (keySize + ptr)) * overhead));
  const N = Math.pow(10, rows);
  const h = Math.max(1, Math.ceil(Math.log(N) / Math.log(fanout)));
  const leafPages = Math.ceil(N / fanout), innerPages = Math.ceil(leafPages / (fanout - 1));
  return (
    <Widget title="Сколько чтений нужно, чтобы найти строку среди N">
      <div className="controls">
        <Slider label="размер страницы, Б" value={page} min={1024} max={65536} step={1024} onChange={setPage} />
        <Slider label="размер ключа, Б" value={keySize} min={4} max={256} step={4} onChange={setKeySize} />
        <Slider label="строк: 10^" value={rows} min={3} max={12} onChange={setRows} />
      </div>
      <div className="stats">
        <Stat k="ветвление B (≈70% заполнения)" v={fanout} />
        <Stat k="высота ⌈log_B N⌉" v={h} />
        <Stat k="строк" v={fmtBig(N)} />
        <Stat k="листовых страниц" v={fmtBig(leafPages)} />
        <Stat k="внутренних страниц" v={fmtBig(innerPages)} />
      </div>
      <p className="small muted">С ветвлением в сотни миллиард строк находится за 4 чтения, а внутренние узлы — всего ~{fmtBig(innerPages)} страниц, около {fmt(100 / (fanout - 1), 2)}% от листьев — почти всегда лежат в буферном пуле — с диска читается 1–2 страницы. Длинные ключи (например, UUID-строки по 36 байт) уменьшают ветвление и увеличивают дерево.</p>
    </Widget>
  );
}

export default function BTreeChapter() {
  return (
    <>
      <h1>B+-деревья и хеш-индексы</h1>
      <p className="lead">Без индекса найти строку — значит прочитать всю таблицу. Индекс — дополнительная структура, которая превращает O(N) чтений в O(log N), а на практике в 2–4. Главная из них уже 50 лет — B+-дерево.</p>

      <h2>Зачем не двоичное дерево</h2>
      <p>
        Сбалансированное двоичное дерево поиска находит ключ за <M t={r`\log_2 N`} /> шагов: для миллиарда строк это 30 шагов, то есть 30 случайных чтений с диска. Байер и Маккрейт <Cite id="bayer1972" /> предложили
        «широкое» дерево, где узел — целая страница с сотнями ключей. Высота становится <M t={r`\log_B N`} />, где <M t="B" /> — ветвление:
      </p>
      <Eq t={r`h = \lceil\log_B N\rceil,\qquad \log_{400}10^9 \approx 3.5 \;\Rightarrow\; 4\ \text{чтения вместо 30}`} />

      <h2>B+-дерево</h2>
      <p>Вариант, который используют почти все СУБД (обзор Комера «The Ubiquitous B-Tree» <Cite id="comer1979" />):</p>
      <ul>
        <li><b>Внутренние узлы</b> хранят только разделители и указатели на детей. Ключ <M t="k" /> ищется в поддереве <M t="i" />, если <M t={r`s_{i} \le k < s_{i+1}`} />.</li>
        <li><b>Листья</b> хранят все ключи и значения (или ссылки на строки) и связаны в список — для диапазонных запросов <code>WHERE x BETWEEN a AND b</code>: спуститься к <code>a</code> и идти вправо по листьям.</li>
        <li><b>Баланс</b>: все листья на одной глубине; каждый узел, кроме корня, заполнен хотя бы наполовину. Это гарантирует <M t={r`O(\log_B N)`} /> на поиск, вставку и удаление в худшем случае.</li>
      </ul>
      <BTreeWidget />
      <h3>Вставка и удаление</h3>
      <p>
        <b>Вставка</b>: спуститься к листу и вставить ключ на место. Если лист переполнился — разделить пополам, копию первого ключа правой половины вставить в родителя. Если переполнился родитель — делить и его;
        средний ключ поднимается выше. <b>Удаление</b>: убрать ключ; если лист стал заполнен меньше чем наполовину, занять ключ у соседа или слиться с ним (и, возможно, убрать разделитель из родителя).
        Многие СУБД ленятся и не сливают узлы сразу — PostgreSQL, например, оставляет пустые страницы до <code>VACUUM</code>.
      </p>
      <FanoutCalc />

      <h2>Индексы на практике</h2>
      <ul>
        <li><b>Кластерный индекс</b> — сами строки таблицы лежат в листьях B+-дерева по первичному ключу (InnoDB, SQL Server, SQLite с <code>WITHOUT ROWID</code>). <b>Вторичный индекс</b> хранит ключ и ссылку на строку: в InnoDB — значение первичного ключа (второй спуск по кластерному индексу), в PostgreSQL, где таблица — куча, — <code>ctid</code>.</li>
        <li><b>Составной индекс</b> <code>(a, b)</code> упорядочен сначала по <code>a</code>, потом по <code>b</code>. Он помогает для <code>WHERE a = ?</code> и <code>WHERE a = ? AND b &gt; ?</code>, но не для <code>WHERE b = ?</code> — правило левого префикса.</li>
        <li><b>Покрывающий индекс</b> содержит все нужные запросу столбцы — таблицу читать не нужно (index-only scan).</li>
        <li><b>Цена индексов</b>: каждая вставка и обновление меняет все индексы таблицы. Индекс ускоряет чтение за счёт записи и места — это общий закон «RUM» (read, update, memory): нельзя оптимизировать все три одновременно <Cite id="athanassoulis2016" />.</li>
      </ul>
      <Callout type="note" title="Конкурентный доступ к B+-дереву">
        <p>Сотни потоков одновременно спускаются по дереву, пока другие делят узлы. Наивное решение — блокировать корень — убивает параллелизм. Лехман и Яо <Cite id="lehman1981" /> предложили B-link-дерево: у каждого узла ссылка на правого соседа и «верхний ключ», поэтому поток, попавший в только что разделённый узел, просто идёт вправо. Вариант этой схемы реализован в PostgreSQL. Современные приёмы (префиксное сжатие ключей, буферизация вставок, оптимистичная блокировка) собраны у Графе <Cite id="graefe2011" />.</p>
      </Callout>

      <h2>Хеш-индексы</h2>
      <p>
        Если нужны только точные поиски <code>WHERE key = ?</code>, хеш-таблица даёт <M t="O(1)" /> чтений. На диске таблица состоит из «корзин»-страниц. Проблема — рост: перехешировать всю таблицу при удвоении слишком дорого.
        <b> Расширяемое хеширование</b> Фагина и др. <Cite id="fagin1979" /> хранит каталог из <M t={r`2^d`} /> указателей, где <M t="d" /> — число используемых бит хеша. Переполнившаяся корзина делится по ещё одному биту, а каталог удваивается только когда это действительно нужно — переписывается одна корзина, а не вся таблица.
      </p>
      <p>Ограничение хешей: они не умеют диапазоны и сортировку (<code>ORDER BY</code>, <code>&lt;</code>, <code>LIKE 'abc%'</code>). Поэтому B+-дерево — индекс по умолчанию, а хеш-индексы — нишевый инструмент (в PostgreSQL есть <code>USING hash</code>; хеш-таблицы широко используются в памяти — для хеш-соединений, глава 8).</p>
      <Callout type="tip" title="Обученные индексы">
        <p>Индекс по сути — модель, которая по ключу предсказывает позицию в отсортированном массиве. Краска и др. <Cite id="kraska2018" /> предложили заменить B+-дерево небольшой иерархией обученных моделей, аппроксимирующих функцию распределения ключей, — на некоторых данных это быстрее и компактнее. Это активная область исследований.</p>
      </Callout>

      <h2>Реализация</h2>
      <Code title="books/db/python/btree.py" collapse>{btreeSrc}</Code>
      <p className="small muted">Запуск <code>python btree.py</code>: вставка 2000 случайных ключей с проверкой инвариантов после каждой, затем зависимость высоты от порядка: порядок 4 → высота 11, 16 → 6, 128 → 4, 400 → 3 (на 10⁵–10⁶ ключей).</p>
      <Quiz q="Индекс (last_name, first_name). Какой запрос НЕ сможет использовать его для поиска?" options={["WHERE last_name = 'Иванов'", "WHERE last_name = 'Иванов' AND first_name = 'Пётр'", "WHERE first_name = 'Пётр'", "WHERE last_name LIKE 'Ив%'"]} answer={2}
        explain="Строки в индексе упорядочены сначала по фамилии; люди с именем «Пётр» разбросаны по всему индексу. Это правило левого префикса." />
      <Quiz q="Почему корень B+-дерева делится, а дерево растёт вверх, а не вниз?" options={['Так проще кодировать', 'Чтобы все листья оставались на одной глубине и дерево было сбалансированным', 'Чтобы корень был в памяти', 'Это особенность PostgreSQL']} answer={1}
        explain="Рост вверх добавляет уровень сразу ко всем путям, сохраняя баланс без перестройки дерева." />
    </>
  );
}
