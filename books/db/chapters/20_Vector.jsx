import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt, fmtBig } from '@shared/ui.jsx';
import { makeRng } from '@shared/rng.js';
import vecSrc from '../python/vector_index.py?raw';

const COLORS = ['#4c6ef5', '#f76707', '#2f9e44', '#ae3ec9', '#1098ad', '#e03131', '#f59f00', '#5c7cfa', '#20c997', '#d6336c', '#845ef7', '#82c91e', '#fd7e14', '#15aabf', '#be4bdb', '#40c057'];
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

function kmeans(pts, k, rng) {
  let c = Array.from({ length: k }, () => pts[Math.floor(rng.rand() * pts.length)].slice());
  let assign = [];
  for (let it = 0; it < 10; it++) {
    assign = pts.map((p) => { let b = 0; for (let j = 1; j < k; j++) if (d2(p, c[j]) < d2(p, c[b])) b = j; return b; });
    c = c.map((old, j) => { const m = pts.filter((_, i) => assign[i] === j); return m.length ? [m.reduce((s, p) => s + p[0], 0) / m.length, m.reduce((s, p) => s + p[1], 0) / m.length] : old; });
  }
  return { c, assign };
}

function IVFWidget() {
  const [nlist, setNlist] = useState(9);
  const [nprobe, setNprobe] = useState(1);
  const [k, setK] = useState(5);
  const [q, setQ] = useState([0.52, 0.48]);
  const pts = useMemo(() => { const rng = makeRng(21); return Array.from({ length: 400 }, () => [rng.rand(), rng.rand()]); }, []);
  const { c, assign } = useMemo(() => kmeans(pts, nlist, makeRng(3)), [pts, nlist]);
  const cells = c.map((cc, j) => [j, d2(q, cc)]).sort((a, b) => a[1] - b[1]).slice(0, nprobe).map((x) => x[0]);
  const cand = pts.map((p, i) => i).filter((i) => cells.includes(assign[i]));
  const exact = pts.map((p, i) => [i, d2(q, p)]).sort((a, b) => a[1] - b[1]).slice(0, k).map((x) => x[0]);
  const approx = cand.map((i) => [i, d2(q, pts[i])]).sort((a, b) => a[1] - b[1]).slice(0, k).map((x) => x[0]);
  const recall = approx.filter((i) => exact.includes(i)).length / k;
  return (
    <Widget title="IVF-индекс: ищем только в ближайших ячейках">
      <div className="controls">
        <Slider label="ячеек (nlist)" value={nlist} min={2} max={16} onChange={(v) => { setNlist(v); setNprobe(Math.min(nprobe, v)); }} />
        <Slider label="просматриваем ячеек (nprobe)" value={nprobe} min={1} max={nlist} onChange={setNprobe} />
        <Slider label="k" value={k} min={1} max={20} onChange={setK} />
      </div>
      <div className="row">
        <svg viewBox="0 0 300 300" style={{ width: 300, maxWidth: '100%', border: '1px solid var(--border)', borderRadius: 8, cursor: 'crosshair' }}
          onClick={(e) => { const rc = e.currentTarget.getBoundingClientRect(); setQ([(e.clientX - rc.left) / rc.width, (e.clientY - rc.top) / rc.height]); }}>
          {pts.map((p, i) => <circle key={i} cx={p[0] * 300} cy={p[1] * 300} r={exact.includes(i) ? 5 : 2.4} fill={COLORS[assign[i] % 16]} opacity={cells.includes(assign[i]) ? 1 : 0.25} stroke={exact.includes(i) ? (approx.includes(i) ? 'var(--text)' : 'var(--red)') : 'none'} strokeWidth={2} />)}
          {c.map((cc, j) => <text key={j} x={cc[0] * 300} y={cc[1] * 300 + 4} textAnchor="middle" fontSize="14" fontWeight="700" style={{ fill: COLORS[j % 16] }}>+</text>)}
          <circle cx={q[0] * 300} cy={q[1] * 300} r={7} fill="var(--amber)" stroke="var(--text)" />
        </svg>
        <div className="col">
          <div className="stats">
            <Stat k="вычислений расстояния" v={`${nlist + cand.length} из ${pts.length}`} />
            <Stat k={`recall@${k}`} v={fmt(100 * recall, 0) + '%'} />
          </div>
          <p className="small">Щёлкните, чтобы задать запрос. Яркие точки — просматриваемые ячейки. Крупные точки — настоящие {k} ближайших соседей; с <span style={{ color: 'var(--red)' }}>красной</span> обводкой — те, что IVF пропустил (они в соседней, непросмотренной ячейке).</p>
          <p className="small muted">Запрос около границы ячеек — худший случай: ближайший сосед может лежать за границей. Увеличение nprobe покупает полноту ценой вычислений.</p>
        </div>
      </div>
    </Widget>
  );
}

function MemoryWidget() {
  const [logN, setLogN] = useState(8);
  const [dim, setDim] = useState(768);
  const [m, setM] = useState(64);
  const N = Math.pow(10, logN);
  const f32 = N * dim * 4, f16 = N * dim * 2, pq = N * m;
  return (
    <Widget title="Сколько памяти занимают векторы">
      <div className="controls">
        <Slider label="векторов: 10^" value={logN} min={4} max={10} step={0.5} onChange={setLogN} format={() => fmtBig(N)} />
        <Slider label="размерность d" value={dim} min={64} max={4096} step={64} onChange={setDim} />
        <Slider label="PQ: подвекторов m (по 1 байту)" value={m} min={8} max={256} step={8} onChange={setM} />
      </div>
      <div className="stats">
        <Stat k="float32" v={fmtBig(f32) + 'Б'} />
        <Stat k="float16" v={fmtBig(f16) + 'Б'} />
        <Stat k={`PQ, ${m} байт на вектор`} v={fmtBig(pq) + 'Б'} />
        <Stat k="сжатие PQ" v={'×' + fmt(f32 / pq, 0)} />
      </div>
      <p className="small muted">Сто миллионов векторов размерности 768 во float32 — около 300 ГБ: в память одного сервера не помещается. Product quantization делит вектор на m частей и заменяет каждую номером ближайшего из 256 центроидов этой части — 1 байт вместо d/m чисел. Расстояния считаются приближённо по таблицам предвычисленных расстояний до центроидов.</p>
    </Widget>
  );
}

export default function Vector() {
  return (
    <>
      <h1>Векторные базы данных</h1>
      <p className="lead">Языковые модели превращают текст, изображения и звук в векторы-эмбеддинги, где близость векторов означает близость смысла. Векторная база находит среди миллиардов векторов ближайшие к запросу — за миллисекунды.</p>

      <h2>Задача</h2>
      <p>Дано <M t="N" /> векторов <M t={r`x_i\in\mathbb R^d`} /> (обычно <M t="d" /> = 256–4096) и запрос <M t="q" />. Найти <M t="k" /> ближайших по одной из мер:</p>
      <Eq t={r`\lVert q - x\rVert_2,\qquad \cos(q, x) = \frac{q\cdot x}{\lVert q\rVert\lVert x\rVert},\qquad q\cdot x`} />
      <p>Для нормированных векторов все три упорядочивают одинаково: <M t={r`\lVert q-x\rVert^2 = 2 - 2\,q\cdot x`} />. Точный поиск — сравнить со всеми: <M t={r`O(N\cdot d)`} />; для миллиарда векторов размерности 768 это ~10¹² операций на запрос. Классические деревья (k-d tree) в высоких размерностях вырождаются в полный перебор — «проклятие размерности». Поэтому ищут <b>приближённо</b> (ANN — approximate nearest neighbors) и измеряют качество как <b>recall@k</b>: долю настоящих ближайших соседей среди найденных.</p>

      <h2>Семейства индексов</h2>
      <ul>
        <li><b>LSH</b> (locality-sensitive hashing) <Cite id="indyk1998" />: хеш-функции, у которых близкие векторы чаще попадают в одну корзину. Есть теоретические гарантии, но на практике уступает графам и IVF.</li>
        <li><b>IVF</b> (inverted file): k-means делит пространство на <code>nlist</code> ячеек; вектор хранится в списке своей ячейки; поиск проверяет <code>nprobe</code> ближайших ячеек.</li>
        <li><b>Квантование</b>: product quantization <Cite id="jegou2011" /> сжимает векторы в 10–100 раз; IVF+PQ позволяет держать в памяти миллиарды векторов. Реализация на GPU — библиотека FAISS <Cite id="johnson2019" />.</li>
        <li><b>Графы</b>: HNSW <Cite id="malkov2016" /> — многоуровневый граф близости; поиск жадно идёт к соседям, ближе к запросу, спускаясь с разреженных верхних уровней на плотные нижние. Обычно лучший компромисс скорость/полнота в памяти; цена — память на рёбра и медленное построение.</li>
      </ul>
      <IVFWidget />
      <MemoryWidget />

      <h2>Компромисс «скорость — полнота»</h2>
      <p>У каждого индекса есть параметры (<code>nprobe</code>, <code>ef_search</code> у HNSW), которые двигают точку на кривой «запросов в секунду против recall». Сравнивать индексы честно можно только по всей кривой — так делает ANN-Benchmarks <Cite id="aumuller2020" />.</p>
      <Code title="books/db/python/vector_index.py" collapse>{vecSrc}</Code>
      <Code lang="bash" title="вывод python vector_index.py">{`
точный поиск: 5,000 вычислений расстояния на запрос, recall@10 = 100%
IVF: 64 ячейки, в ячейке от 22 до 121 векторов
  nprobe= 1:    147 вычислений на запрос ( 2.9% от точного), recall@10 =  60.0%
  nprobe= 2:    221 вычислений на запрос ( 4.4% от точного), recall@10 =  74.6%
  nprobe= 4:    377 вычислений на запрос ( 7.5% от точного), recall@10 =  85.8%
  nprobe= 8:    674 вычислений на запрос (13.5% от точного), recall@10 =  94.3%
  nprobe=16:  1,271 вычислений на запрос (25.4% от точного), recall@10 =  98.9%
`}</Code>

      <h2>Векторная база — это не только индекс</h2>
      <ul>
        <li><b>Фильтры</b>: «похожие товары, но только в наличии и дешевле 5000». Фильтр до поиска ломает структуру графа, фильтр после — может оставить меньше k результатов. Системы комбинируют подходы в зависимости от селективности фильтра.</li>
        <li><b>Гибридный поиск</b>: сочетание векторной близости и классического полнотекстового ранжирования (BM25, глава 16) — точные совпадения названий и смысловая близость дополняют друг друга.</li>
        <li><b>Обновления</b>: HNSW плохо переносит удаления; IVF требует периодически переобучать центроиды. Часто используют LSM-подобную схему: свежие векторы — в небольшом индексе, фоновое слияние в большой.</li>
        <li>Обзор архитектур векторных СУБД — у Пана, Вана и Ли <Cite id="pan2024" />. Специализированные системы: Milvus, Qdrant, Weaviate, Pinecone; расширения существующих СУБД: pgvector для PostgreSQL, векторные индексы в Elasticsearch, Redis, ClickHouse.</li>
      </ul>
      <Code lang="sql" title="pgvector — векторный поиск в PostgreSQL">{`
CREATE EXTENSION vector;
CREATE TABLE docs (id bigserial PRIMARY KEY, body text, price int, embedding vector(768));
CREATE INDEX ON docs USING hnsw (embedding vector_cosine_ops);   -- или ivfflat (lists = 1000)

SET hnsw.ef_search = 100;           -- больше — выше полнота, медленнее
SELECT id, body
FROM docs
WHERE price < 5000                  -- обычный SQL-фильтр рядом с векторным поиском
ORDER BY embedding <=> $1           -- <=> — косинусное расстояние до вектора запроса
LIMIT 10;
`}</Code>
      <Callout type="tip" title="RAG">
        <p>В системах retrieval-augmented generation векторный поиск находит фрагменты документов, близкие к вопросу пользователя, и они передаются языковой модели как контекст. Качество ответа во многом определяется качеством поиска: разбиением на фрагменты, эмбеддингами, гибридным ранжированием, фильтрами по метаданным.</p>
      </Callout>
      <Quiz q="Почему векторные базы ищут приближённо, а не точно?" options={['Точный поиск невозможен', 'Точный поиск стоит O(N·d) на запрос; при миллиардах векторов это слишком долго, а небольшая потеря полноты обычно приемлема', 'Векторы хранятся неточно', 'Из-за нормализации']} answer={1}
        explain="Recall 95–99% при в десятки–сотни раз меньшей работе — типичный компромисс." />
      <Quiz q="Что даёт product quantization?" options={['Ускоряет построение графа', 'Сжимает каждый вектор до m байт (номера центроидов подвекторов), позволяя держать в памяти в десятки раз больше векторов', 'Повышает точность', 'Удаляет дубликаты']} answer={1}
        explain="768 float32 = 3072 байта против, например, 64 байт — в 48 раз меньше." />
    </>
  );
}
