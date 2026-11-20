import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt } from '@shared/ui.jsx';

const NODES = ['Аня', 'Борис', 'Вера', 'Глеб', 'Даша', 'Егор', 'Жанна', 'Зоя', 'Иван', 'Кира'];
const POS = [[60, 60], [170, 40], [280, 70], [100, 160], [210, 150], [330, 170], [60, 260], [180, 250], [300, 270], [400, 90]];
const EDGES = [[0, 1], [0, 3], [1, 2], [1, 4], [2, 5], [2, 9], [3, 4], [3, 6], [4, 7], [5, 8], [6, 7], [7, 8], [5, 9]];

function bfs(start) {
  const adj = NODES.map(() => []);
  EDGES.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  const dist = NODES.map(() => Infinity), prev = NODES.map(() => -1);
  dist[start] = 0;
  const q = [start];
  let edgesSeen = 0;
  while (q.length) { const v = q.shift(); for (const w of adj[v]) { edgesSeen++; if (dist[w] === Infinity) { dist[w] = dist[v] + 1; prev[w] = v; q.push(w); } } }
  return { dist, prev, edgesSeen };
}

function TraversalWidget() {
  const [start, setStart] = useState(0);
  const [depth, setDepth] = useState(2);
  const [target, setTarget] = useState(8);
  const { dist, prev } = useMemo(() => bfs(start), [start]);
  const path = []; for (let v = target; v !== -1; v = prev[v]) path.unshift(v);
  const onPath = (a, b) => path.some((v, i) => i > 0 && ((path[i - 1] === a && v === b) || (path[i - 1] === b && v === a)));
  const reached = dist.filter((d) => d > 0 && d <= depth).length;
  return (
    <Widget title="Обход графа: друзья друзей и кратчайший путь">
      <div className="controls">
        <Slider label="глубина обхода" value={depth} min={1} max={5} onChange={setDepth} />
        <span className="small">старт — щелчок по вершине; цель пути: <select value={target} onChange={(e) => setTarget(+e.target.value)}>{NODES.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></span>
      </div>
      <svg viewBox="0 0 460 300" style={{ width: '100%', maxWidth: 460 }}>
        {EDGES.map(([a, b], i) => <line key={i} x1={POS[a][0]} y1={POS[a][1]} x2={POS[b][0]} y2={POS[b][1]} stroke={onPath(a, b) ? 'var(--amber)' : 'var(--border)'} strokeWidth={onPath(a, b) ? 4 : 1.5} />)}
        {NODES.map((n, i) => (
          <g key={i} onClick={() => setStart(i)} style={{ cursor: 'pointer' }}>
            <circle cx={POS[i][0]} cy={POS[i][1]} r={22} fill={i === start ? 'var(--accent)' : dist[i] <= depth ? 'var(--accent-soft)' : 'var(--bg-soft)'} stroke="var(--accent)" />
            <text x={POS[i][0]} y={POS[i][1] + 4} textAnchor="middle" fontSize="11" style={{ fill: i === start ? '#fff' : undefined }}>{n}</text>
            {i !== start && dist[i] < Infinity && <text x={POS[i][0] + 18} y={POS[i][1] - 16} fontSize="10" style={{ fill: 'var(--muted)' }}>{dist[i]}</text>}
          </g>
        ))}
      </svg>
      <div className="stats">
        <Stat k={`достижимо за ≤ ${depth} шаг.`} v={reached} />
        <Stat k={`путь ${NODES[start]} → ${NODES[target]}`} v={path.map((v) => NODES[v]).join(' → ')} />
        <Stat k="самосоединений в SQL" v={depth} />
      </div>
      <Code lang="sql" title="Cypher (Neo4j)">{`MATCH (a:Person {name: '${NODES[start]}'})-[:FRIEND*1..${depth}]-(f:Person)
RETURN DISTINCT f.name;

MATCH p = shortestPath((a:Person {name: '${NODES[start]}'})-[:FRIEND*]-(b:Person {name: '${NODES[target]}'}))
RETURN [n IN nodes(p) | n.name];`}</Code>
    </Widget>
  );
}

function PageRankWidget() {
  const [d, setD] = useState(0.85);
  const [iters, setIters] = useState(20);
  // ориентированный граф ссылок между страницами
  const links = [[0, 1], [0, 2], [1, 2], [2, 0], [3, 2], [4, 2], [4, 3], [5, 4], [5, 2], [6, 5], [6, 2]];
  const N = 7;
  const res = useMemo(() => {
    let pr = Array(N).fill(1 / N);
    const out = Array(N).fill(0); links.forEach(([a]) => out[a]++);
    for (let t = 0; t < iters; t++) {
      const nx = Array(N).fill((1 - d) / N);
      links.forEach(([a, b]) => { nx[b] += (d * pr[a]) / out[a]; });
      const dangling = pr.reduce((s, p, i) => s + (out[i] ? 0 : p), 0);
      pr = nx.map((x) => x + (d * dangling) / N);
    }
    return pr;
  }, [d, iters]);
  return (
    <Widget title="PageRank: важность вершины по структуре ссылок">
      <div className="controls">
        <Slider label="коэффициент затухания d" value={d} min={0} max={0.99} step={0.01} onChange={setD} />
        <Slider label="итераций" value={iters} min={0} max={50} onChange={setIters} />
      </div>
      {res.map((p, i) => (
        <div key={i} className="bar-row"><span className="lbl">стр. {i}</span><span className="track"><span className="fill" style={{ width: `${(100 * p) / Math.max(...res)}%`, display: 'block' }} /></span><span className="val">{fmt(p, 3)}</span></div>
      ))}
      <p className="small muted">Ссылки: {links.map(([a, b]) => `${a}→${b}`).join(', ')}. Страница 2, на которую ссылаются почти все, получает наибольший вес; страница 0 важна, потому что на неё ссылается важная страница 2. При d = 0 все страницы равны (случайный переход куда угодно).</p>
    </Widget>
  );
}

export default function Graph() {
  return (
    <>
      <h1>Графовые базы данных</h1>
      <p className="lead">Когда в данных главное — не сами записи, а связи между ними на много шагов вглубь (соцсети, рекомендации, мошеннические схемы, зависимости), удобнее хранить граф и обходить его напрямую.</p>

      <h2>Модели</h2>
      <ul>
        <li><b>Граф свойств</b> (property graph): вершины и рёбра с метками и произвольными свойствами: <code>(:Person {'{'}name: 'Аня'{'}'})-[:FRIEND {'{'}since: 2019{'}'}]-&gt;(:Person)</code>. Neo4j, Memgraph, TigerGraph, Amazon Neptune.</li>
        <li><b>RDF</b>: всё — тройки (субъект, предикат, объект); язык запросов SPARQL; основа семантического веба и графов знаний (Wikidata).</li>
      </ul>
      <p>Обзор моделей графовых баз данных — у Анхелеса и Гутьерреса <Cite id="angles2008" />; современное состояние и открытые проблемы — в совместной статье исследователей графовых систем <Cite id="sakr2021" />.</p>

      <h2>Почему не просто таблица рёбер</h2>
      <p>
        В реляционной БД граф — таблица <code>edges(src, dst)</code>. «Друзья друзей» — самосоединение; «на глубину до 5» — пять самосоединений или рекурсивный CTE (глава 1). Каждый шаг — поиск по индексу <code>edges(src)</code>: <M t={r`O(\log E)`} /> на соседа.
        Графовые СУБД вроде Neo4j используют <b>index-free adjacency</b>: запись вершины напрямую указывает на список её рёбер, и переход к соседу — разыменование указателя. Стоимость обхода пропорциональна числу просмотренных рёбер, а не размеру всего графа. Этот выигрыш ощутим на глубоких обходах; на запросах «по всем вершинам» реляционные и колоночные системы обычно не хуже.
      </p>
      <TraversalWidget />

      <h2>Языки запросов</h2>
      <p>
        Главная идея — сопоставление с образцом (pattern matching): нарисовать ASCII-стрелками фрагмент графа, который нужно найти. Cypher <Cite id="francis2018" /> (Neo4j) стал основой стандарта: в 2023 году в SQL вошла часть SQL/PGQ (графовые запросы к реляционным таблицам), а в 2024 году ISO выпустил отдельный язык GQL <Cite id="deutsch2022" />. Также используются Gremlin (обход как цепочка шагов) и SPARQL для RDF.
      </p>
      <Code lang="sql" title="рекомендация «друзья друзей, которые не мои друзья» — Cypher и SQL">{`
-- Cypher
MATCH (me:Person {name: 'Аня'})-[:FRIEND]-(f)-[:FRIEND]-(fof)
WHERE fof <> me AND NOT (me)-[:FRIEND]-(fof)
RETURN fof.name, count(f) AS mutual ORDER BY mutual DESC LIMIT 10;

-- то же самое в SQL (рёбра храним в обе стороны)
SELECT p.name, count(*) AS mutual
FROM persons me
JOIN friends e1 ON e1.src = me.id
JOIN friends e2 ON e2.src = e1.dst
JOIN persons p  ON p.id = e2.dst
WHERE me.name = 'Аня' AND e2.dst <> me.id
  AND NOT EXISTS (SELECT 1 FROM friends x WHERE x.src = me.id AND x.dst = e2.dst)
GROUP BY p.name ORDER BY mutual DESC LIMIT 10;
`}</Code>

      <h2>Графовые алгоритмы</h2>
      <p>Кроме запросов-обходов, на графах считают глобальные характеристики: кратчайшие пути, связные компоненты, сообщества, центральность. Классика — PageRank <Cite id="page1999" />: вес страницы — вероятность оказаться на ней при случайном блуждании по ссылкам с периодическими «телепортациями» в случайное место:</p>
      <Eq t={r`PR(v) = \frac{1-d}{N} + d\sum_{u\to v}\frac{PR(u)}{\deg^+(u)}`} />
      <PageRankWidget />
      <p>
        Для графов из миллиардов рёбер, которые не помещаются на одну машину, Google предложил Pregel <Cite id="malewicz2010" />: модель «думай как вершина» — вычисление идёт супершагами, на каждом вершина получает сообщения от соседей, обновляет своё состояние и рассылает новые сообщения. На этой модели построены Apache Giraph и GraphX в Spark.
      </p>
      <Callout type="tip" title="Когда нужна графовая СУБД">
        <p>Если типичный запрос — «пройти по связям на неизвестную заранее глубину» или «найти путь/шаблон», графовая модель и выразительнее, и обычно быстрее. Если связи — обычные внешние ключи на 1–2 шага, реляционная СУБД с индексами (и рекурсивными CTE для редких глубоких запросов) справится и сохранит транзакции, ограничения и привычную экосистему.</p>
      </Callout>
      <Quiz q="Что такое index-free adjacency?" options={['Граф без индексов', 'Вершина хранит прямые ссылки на свои рёбра/соседей, переход к соседу — разыменование указателя без поиска по индексу', 'Хранение рёбер в B+-дереве', 'Отказ от свойств у рёбер']} answer={1}
        explain="Стоимость шага обхода не зависит от размера всего графа." />
      <Quiz q="Почему при d = 0 у всех страниц одинаковый PageRank?" options={['Ошибка формулы', 'Случайный блуждатель всегда телепортируется в случайную страницу и вообще не идёт по ссылкам', 'Граф несвязный', 'Так задумано для тупиков']} answer={1}
        explain="Первое слагаемое (1−d)/N становится 1/N, второе — нулём." />
    </>
  );
}
