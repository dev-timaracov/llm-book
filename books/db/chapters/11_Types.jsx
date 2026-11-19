import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt } from '@shared/ui.jsx';
import { makeRng } from '@shared/rng.js';

const TYPES = [
  { name: 'Реляционные (OLTP)', model: 'таблицы, SQL, ограничения, транзакции', inside: 'страницы, B+-деревья, WAL, MVCC (гл. 1–9)', ex: 'PostgreSQL, MySQL, Oracle, SQL Server, SQLite', when: 'бизнес-данные со связями и инвариантами — выбор по умолчанию' },
  { name: 'Аналитические (OLAP)', model: 'SQL над огромными таблицами', inside: 'колоночное хранение, сжатие, векторное исполнение (гл. 1, 5)', ex: 'ClickHouse, DuckDB, Snowflake, BigQuery, Vertica', when: 'отчёты и агрегации по миллиардам строк' },
  { name: 'Ключ-значение', model: 'get / put / delete по ключу', inside: 'хеш-таблицы или LSM (гл. 3–4)', ex: 'Redis, RocksDB, DynamoDB, etcd', when: 'кэши, сессии, счётчики, хранилище внутри других систем' },
  { name: 'Документные', model: 'JSON-документы, вложенные структуры', inside: 'B+-деревья/LSM по полям документов', ex: 'MongoDB, Couchbase; jsonb в PostgreSQL', when: 'данные — самодостаточные «агрегаты», схема меняется часто' },
  { name: 'Широкие столбцы', model: 'строка → множество колонок, ключ разделения + сортировка', inside: 'LSM, шардирование по хешу, кворумы (гл. 4, 10)', ex: 'Cassandra, ScyllaDB, HBase, Bigtable', when: 'огромный поток записей, запросы по известному ключу' },
  { name: 'Графовые', model: 'вершины и рёбра со свойствами', inside: 'списки смежности, обход без соединений', ex: 'Neo4j, JanusGraph, Memgraph', when: 'многошаговые связи: соцсети, рекомендации, мошенничество' },
  { name: 'Временные ряды', model: '(метрика, метки, время) → значение', inside: 'сжатие по времени, партиции по интервалам', ex: 'Prometheus, InfluxDB, TimescaleDB, Gorilla', when: 'метрики, датчики, телеметрия' },
  { name: 'Поисковые', model: 'документы, полнотекстовые запросы, ранжирование', inside: 'инвертированный индекс', ex: 'Elasticsearch/OpenSearch, Lucene, Meilisearch', when: 'поиск по тексту, логи, фасеты' },
  { name: 'Векторные', model: 'векторы-эмбеддинги, поиск ближайших', inside: 'графы HNSW, IVF, квантование', ex: 'pgvector, Milvus, Qdrant, FAISS', when: 'семантический поиск, RAG, рекомендации' },
  { name: 'In-memory / NewSQL', model: 'SQL + горизонтальное масштабирование', inside: 'всё в памяти и/или консенсус + шардирование (гл. 10)', ex: 'VoltDB (H-Store), CockroachDB, Spanner, TiDB, YugabyteDB', when: 'нужны и SQL-транзакции, и масштаб на много машин' },
];

const QUESTIONS = [
  { q: 'Основная нагрузка', opts: [['много коротких транзакций (заказы, счета)', { 'Реляционные (OLTP)': 3, 'In-memory / NewSQL': 1 }], ['тяжёлые аналитические запросы', { 'Аналитические (OLAP)': 4 }], ['огромный поток записей событий', { 'Широкие столбцы': 3, 'Временные ряды': 2, 'Ключ-значение': 1 }], ['поиск похожего (текст, смысл)', { 'Поисковые': 3, 'Векторные': 3 }]] },
  { q: 'Как устроены данные', opts: [['таблицы со связями', { 'Реляционные (OLTP)': 2, 'Аналитические (OLAP)': 1 }], ['вложенные документы', { 'Документные': 3 }], ['граф связей, важны пути', { 'Графовые': 4 }], ['метрики во времени', { 'Временные ряды': 4 }], ['просто ключ → значение', { 'Ключ-значение': 4 }]] },
  { q: 'Объём и масштаб', opts: [['помещается на один сервер', { 'Реляционные (OLTP)': 2, 'Аналитические (OLAP)': 1 }], ['нужно много серверов и датацентров', { 'In-memory / NewSQL': 2, 'Широкие столбцы': 2, 'Ключ-значение': 1 }]] },
  { q: 'Насколько важны строгие транзакции', opts: [['критично (деньги)', { 'Реляционные (OLTP)': 3, 'In-memory / NewSQL': 2 }], ['допустима итоговая согласованность', { 'Широкие столбцы': 1, 'Документные': 1, 'Ключ-значение': 1 }]] },
];

function Chooser() {
  const [ans, setAns] = useState([0, 0, 0, 0]);
  const score = {};
  ans.forEach((a, i) => Object.entries(QUESTIONS[i].opts[a][1]).forEach(([k, v]) => (score[k] = (score[k] || 0) + v)));
  const top = Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <Widget title="Подбор типа базы данных" badge="подсказка">
      {QUESTIONS.map((q, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div className="small"><b>{q.q}</b></div>
          <div className="controls" style={{ marginBottom: 0 }}>{q.opts.map(([l], j) => <button key={j} className={'btn small' + (ans[i] === j ? ' primary' : '')} onClick={() => { const n = [...ans]; n[i] = j; setAns(n); }}>{l}</button>)}</div>
        </div>
      ))}
      <ol>{top.map(([k]) => { const t = TYPES.find((x) => x.name === k); return <li key={k}><b>{k}</b> — {t.ex}. <span className="muted small">{t.when}.</span></li>; })}</ol>
      <p className="small muted">Это эвристика, а не приговор. Частый правильный ответ — «начните с PostgreSQL»: в нём есть jsonb, полнотекстовый поиск, pgvector, расширения для временных рядов, а специализированная система нужна, когда упираетесь в конкретный предел.</p>
    </Widget>
  );
}

const DOCS = ['B+-дерево хранит ключи в листьях', 'LSM-дерево пишет данные последовательно', 'журнал защищает данные от сбоя', 'дерево поиска и хеш-таблица', 'MVCC хранит версии строк'];
function InvertedIndex() {
  const [docs, setDocs] = useState(DOCS.join('\n'));
  const [q, setQ] = useState('дерево данные');
  const list = docs.split('\n').filter(Boolean);
  const tok = (s) => s.toLowerCase().split(/[^a-zа-яё0-9+]+/i).filter((w) => w.length > 1);
  const index = {};
  list.forEach((d, i) => tok(d).forEach((w) => { index[w] = index[w] || new Set(); index[w].add(i); }));
  const terms = tok(q);
  const postings = terms.map((t) => [t, [...(index[t] || [])]]);
  const and = terms.length ? postings.reduce((acc, [, p]) => acc.filter((x) => p.includes(x)), list.map((_, i) => i)) : [];
  // ранжирование TF-IDF: idf = ln(N / df)
  const scores = list.map((d, i) => terms.reduce((s, t) => s + (tok(d).filter((w) => w === t).length) * Math.log(list.length / Math.max(1, (index[t] || new Set()).size)), 0));
  const ranked = list.map((d, i) => [i, scores[i]]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
  return (
    <Widget title="Инвертированный индекс: слово → список документов">
      <div className="row">
        <div className="col"><textarea rows={6} value={docs} onChange={(e) => setDocs(e.target.value)} /></div>
        <div className="col">
          <p className="small">Запрос: <input type="text" value={q} onChange={(e) => setQ(e.target.value)} /></p>
          {postings.map(([t, p]) => <div key={t} className="mono small">«{t}» → [{p.map((x) => 'd' + x).join(', ')}]</div>)}
          <p className="small">AND (пересечение): {and.map((x) => 'd' + x).join(', ') || 'ничего'}</p>
          <p className="small">OR с ранжированием TF·IDF:</p>
          {ranked.map(([i, s]) => <div key={i} className="small">d{i} ({fmt(s, 2)}): {list[i]}</div>)}
        </div>
      </div>
      <p className="small muted">Поиск по тексту = пересечение отсортированных списков номеров документов (postings). Редкие слова важнее частых — idf = ln(N/df). Реальные системы добавляют стемминг/лемматизацию («дерево» = «деревья»), сжатие списков и ранжирование BM25 (обзор — Zobel & Moffat <Cite id="zobel2006" />).</p>
    </Widget>
  );
}

function VectorSearch() {
  const [k, setK] = useState(3);
  const [qx, setQx] = useState(0.6), [qy, setQy] = useState(0.4);
  const pts = useMemo(() => { const rng = makeRng(9); const c = [[0.25, 0.3], [0.7, 0.7], [0.75, 0.25]]; return Array.from({ length: 60 }, (_, i) => { const [a, b] = c[i % 3]; return [a + rng.randn() * 0.08, b + rng.randn() * 0.08, i % 3]; }); }, []);
  const d = pts.map(([x, y], i) => [i, Math.hypot(x - qx, y - qy)]).sort((a, b) => a[1] - b[1]);
  const nn = new Set(d.slice(0, k).map((x) => x[0]));
  const col = ['var(--c1)', 'var(--c2)', 'var(--c3)'];
  return (
    <Widget title="Векторный поиск: k ближайших соседей">
      <div className="row">
        <svg viewBox="0 0 260 260" style={{ width: 260, maxWidth: '100%', border: '1px solid var(--border)', borderRadius: 8, cursor: 'crosshair' }}
          onClick={(e) => { const rc = e.currentTarget.getBoundingClientRect(); setQx((e.clientX - rc.left) / rc.width); setQy(1 - (e.clientY - rc.top) / rc.height); }}>
          {pts.map(([x, y, c], i) => <circle key={i} cx={x * 260} cy={(1 - y) * 260} r={nn.has(i) ? 6 : 3.5} fill={col[c]} stroke={nn.has(i) ? 'var(--text)' : 'none'} />)}
          {d.slice(0, k).map(([i]) => <line key={i} x1={qx * 260} y1={(1 - qy) * 260} x2={pts[i][0] * 260} y2={(1 - pts[i][1]) * 260} stroke="var(--muted)" strokeDasharray="3 2" />)}
          <circle cx={qx * 260} cy={(1 - qy) * 260} r={7} fill="var(--amber)" stroke="var(--text)" />
        </svg>
        <div className="col">
          <Slider label="k" value={k} min={1} max={10} onChange={setK} />
          <p className="small">Щёлкните, чтобы задать запрос. Точный поиск сравнивает запрос со всеми {pts.length} векторами — <M t="O(N\cdot d)" />. Для миллиарда векторов размерности 768 это слишком дорого.</p>
          <p className="small">Приближённые индексы жертвуют точностью ради скорости. <b>HNSW</b> <Cite id="malkov2016" /> строит многоуровневый граф «тесного мира»: верхние уровни разреженные (длинные прыжки), нижние — плотные; поиск жадно спускается к ближайшим соседям за примерно логарифмическое число шагов.</p>
        </div>
      </div>
    </Widget>
  );
}

export default function Types() {
  return (
    <>
      <h1>Виды баз данных</h1>
      <p className="lead">«Какая база данных лучше?» — неправильный вопрос. Каждый вид — набор компромиссов из предыдущих глав, подобранный под конкретную форму данных и нагрузки.</p>

      <h2>Почему их так много</h2>
      <p>
        Стоунбрейкер и Четинтемель <Cite id="stonebraker2005one" /> в 2005 году заявили, что эпоха «одна СУБД для всего» закончилась: специализированные системы обходят универсальные на порядок в своих нишах (аналитика, потоки, тексты, наука).
        Двадцать лет спустя Стоунбрейкер и Павло <Cite id="stonebraker2024" /> подвели итог: многие «альтернативные» модели (документы, ключ-значение, графы) раз за разом возвращаются к SQL и реляционной модели или поглощаются ими, а реальные инновации — в устройстве движков: колоночное хранение, облачная архитектура, векторное исполнение.
      </p>
      <table>
        <thead><tr><th>Вид</th><th>Модель</th><th>Что внутри</th><th>Примеры</th><th>Когда</th></tr></thead>
        <tbody>{TYPES.map((t) => <tr key={t.name}><td><b>{t.name}</b></td><td>{t.model}</td><td className="small">{t.inside}</td><td className="small">{t.ex}</td><td className="small">{t.when}</td></tr>)}</tbody>
      </table>
      <Chooser />

      <h2>Реляционные: OLTP и OLAP</h2>
      <p>OLTP-системы — всё, что мы разбирали в главах 1–9: строчное хранение, B+-деревья, MVCC, WAL. Аналитические системы хранят данные по столбцам <Cite id="stonebraker2005cstore,abadi2008" />, сильно сжимают их и исполняют запросы векторами <Cite id="boncz2005" />. Отдельная ветвь — встроенные СУБД (SQLite для OLTP, DuckDB для аналитики), которые работают внутри процесса приложения без сервера.</p>

      <h2>Ключ-значение, документы, широкие столбцы</h2>
      <p>
        Dynamo <Cite id="decandia2007" /> и Bigtable <Cite id="chang2006" /> — две статьи, породившие движение NoSQL. Dynamo — ключ-значение без лидера с согласованным хешированием и кворумами (глава 10). Bigtable — «разреженная многомерная отсортированная карта»: (строка, колонка, время) → значение, хранится в LSM-деревьях. Cassandra <Cite id="lakshman2010" /> объединила модель данных Bigtable с распределённостью Dynamo.
        Документные базы хранят целые JSON-объекты: удобно, когда данные читаются агрегатом (заказ со всеми позициями), неудобно для связей «многие ко многим».
      </p>

      <h2>Графовые</h2>
      <p>Вопрос «друзья друзей друзей, которые любят то же, что и я» в SQL — цепочка самосоединений, стоимость растёт с каждым шагом. Графовые СУБД хранят у каждой вершины ссылки на соседей (index-free adjacency), и обход стоит пропорционально числу посещённых рёбер. Обзор моделей — у Анхелеса и Гутьерреса <Cite id="angles2008" />. Запросы пишут на Cypher/GQL (в 2024 году ISO утвердил стандарт GQL) или Gremlin.</p>

      <h2>Временные ряды</h2>
      <p>Данные почти всегда дописываются в конец и читаются диапазонами времени. Gorilla <Cite id="pelkonen2015" /> (Facebook) показала, как сжать точки метрик примерно до 1.4 байта: метки времени — дельта-от-дельты (интервалы почти постоянны), значения — XOR с предыдущим (соседние значения похожи, в XOR много нулей).</p>

      <h2>Поиск по тексту</h2>
      <InvertedIndex />

      <h2>Векторные</h2>
      <p>Эмбеддинги текстов и изображений (векторы из сотен–тысяч чисел, близкие для похожих по смыслу объектов) нужны для семантического поиска и RAG в системах с LLM. Запрос — найти <M t="k" /> векторов, ближайших по косинусному или евклидову расстоянию.</p>
      <VectorSearch />

      <h2>In-memory и NewSQL</h2>
      <p>
        Если данные помещаются в память, большая часть машинерии классической СУБД — накладные расходы <Cite id="harizopoulos2008" />. H-Store <Cite id="kallman2008" /> (коммерчески — VoltDB) хранит всё в памяти, делит данные на партиции и выполняет транзакции каждой партиции последовательно в одном потоке — без блокировок и защёлок вовсе.
        NewSQL-системы (Spanner <Cite id="corbett2012" />, CockroachDB, TiDB, YugabyteDB) сочетают SQL и ACID-транзакции с горизонтальным масштабированием: данные делятся на диапазоны, каждый реплицируется через консенсус (Paxos/Raft), поверх — распределённые транзакции.
      </p>
      <Quiz q="Нужно хранить 1 млн метрик с 200 серверов раз в 10 секунд и строить графики за последние сутки. Что подойдёт лучше всего?" options={['Графовая СУБД', 'База временных рядов (или колоночная)', 'Документная', 'Векторная']} answer={1}
        explain="Дописывание в конец, чтение диапазонами времени, сильное сжатие — ровно профиль TSDB." />
      <Quiz q="Почему «друзья друзей друзей» дорого в реляционной СУБД?" options={['SQL не поддерживает такие запросы', 'Каждый шаг — самосоединение большой таблицы связей; без хорошего плана и индексов промежуточные результаты взрываются', 'Из-за MVCC', 'Из-за WAL']} answer={1}
        explain="В графовых СУБД шаг обхода — переход по ссылкам соседей; стоимость зависит от числа рёбер, а не от размера таблицы." />
    </>
  );
}
