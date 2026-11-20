import React, { useMemo, useState } from 'react';
import { M, Cite, Callout, Code, Quiz, Widget, Slider, Stat } from '@shared/ui.jsx';
import mrSrc from '../python/mapreduce.py?raw';

// ---------- MapReduce ----------
const crc = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
function MapReduceWidget() {
  const [text, setText] = useState('to be or not to be\nthe question is to be\nnot to be is the answer\nbe the change');
  const [M_, setM] = useState(2);
  const [R, setR] = useState(2);
  const [combine, setCombine] = useState(false);
  const lines = text.split('\n').filter(Boolean);
  const maps = Array.from({ length: M_ }, (_, m) => {
    const pairs = lines.filter((_, i) => i % M_ === m).flatMap((l) => l.toLowerCase().split(/\s+/).filter(Boolean).map((w) => [w, 1]));
    if (!combine) return pairs;
    const agg = {}; pairs.forEach(([w, c]) => (agg[w] = (agg[w] || 0) + c));
    return Object.entries(agg);
  });
  const parts = Array.from({ length: R }, (_, r) => maps.flatMap((p) => p.filter(([w]) => crc(w) % R === r)));
  const reduced = parts.map((p) => { const g = {}; p.forEach(([w, c]) => (g[w] = (g[w] || 0) + c)); return Object.entries(g).sort(); });
  const shuffled = parts.reduce((s, p) => s + p.length, 0);
  const box = (title, items, color) => (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 6, minWidth: 130, background: color }}>
      <div className="small" style={{ fontWeight: 600 }}>{title}</div>
      <div className="mono" style={{ fontSize: 11, lineHeight: 1.4 }}>{items.map(([w, c], i) => <div key={i}>({w}, {c})</div>)}</div>
    </div>
  );
  return (
    <Widget title="MapReduce: подсчёт слов">
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="controls">
        <Slider label="map-задач M" value={M_} min={1} max={4} onChange={setM} />
        <Slider label="reduce-задач R" value={R} min={1} max={4} onChange={setR} />
        <label className="small"><input type="checkbox" checked={combine} onChange={() => setCombine(!combine)} /> комбайнер (свернуть внутри map)</label>
      </div>
      <p className="small"><b>1. map</b>: каждая задача читает свои строки и выдаёт пары (слово, 1)</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{maps.map((p, m) => box(`map ${m + 1}`, p, 'var(--accent-soft)'))}</div>
      <p className="small"><b>2. shuffle</b>: пара уходит в reduce-задачу номер hash(слово) mod R — все пары одного слова встречаются в одном месте</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{parts.map((p, r) => box(`→ reduce ${r + 1}`, p, 'var(--amber-soft)'))}</div>
      <p className="small"><b>3. reduce</b>: сложить единицы каждого слова</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{reduced.map((p, r) => box(`reduce ${r + 1}`, p, 'var(--green-soft)'))}</div>
      <div className="stats"><Stat k="пар передано по сети (shuffle)" v={shuffled} /></div>
    </Widget>
  );
}

// ---------- окна по времени события и watermark ----------
const EVENTS = [
  { id: 'a', t: 2, arrive: 3 }, { id: 'b', t: 4, arrive: 5 }, { id: 'c', t: 7, arrive: 8 }, { id: 'd', t: 3, arrive: 9 },
  { id: 'e', t: 11, arrive: 12 }, { id: 'f', t: 9, arrive: 13 }, { id: 'g', t: 14, arrive: 15 }, { id: 'h', t: 6, arrive: 17 },
  { id: 'i', t: 18, arrive: 19 }, { id: 'j', t: 12, arrive: 21 },
];
function WindowWidget() {
  const [win, setWin] = useState(5);
  const [lag, setLag] = useState(3);
  // окно [k·win, (k+1)·win) закрывается, когда watermark = (max увиденное время события − lag) переходит его конец
  const res = useMemo(() => {
    const out = {}; const closed = {}; let maxT = -Infinity; const late = [];
    const sorted = [...EVENTS].sort((a, b) => a.arrive - b.arrive);
    for (const e of sorted) {
      const w = Math.floor(e.t / win);
      if (closed[w]) late.push(e.id); else (out[w] = out[w] || []).push(e.id);
      maxT = Math.max(maxT, e.t);
      const wm = maxT - lag;
      Object.keys(out).forEach((k) => { if ((+k + 1) * win <= wm) closed[k] = closed[k] || e.arrive; });
    }
    return { out, closed, late };
  }, [win, lag]);
  return (
    <Widget title="Потоковая обработка: окна по времени события и watermark">
      <div className="controls">
        <Slider label="размер окна" value={win} min={2} max={10} onChange={setWin} />
        <Slider label="задержка watermark (сколько ждём опоздавших)" value={lag} min={0} max={10} onChange={setLag} />
      </div>
      <table className="small">
        <thead><tr><th>событие</th>{EVENTS.map((e) => <th key={e.id}>{e.id}</th>)}</tr></thead>
        <tbody>
          <tr><td>время события</td>{EVENTS.map((e) => <td key={e.id}>{e.t}</td>)}</tr>
          <tr><td>время прихода</td>{EVENTS.map((e) => <td key={e.id}>{e.arrive}</td>)}</tr>
          <tr><td>опоздало на</td>{EVENTS.map((e) => <td key={e.id} style={{ background: e.arrive - e.t > 2 ? 'var(--amber-soft)' : undefined }}>{e.arrive - e.t}</td>)}</tr>
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(res.out).sort((a, b) => a[0] - b[0]).map(([k, ids]) => (
          <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px' }} className="small">
            окно [{k * win}, {(+k + 1) * win}): <b>{ids.length}</b> ({ids.join(', ')}) {res.closed[k] ? `— закрыто в момент ${res.closed[k]}` : '— ещё открыто'}
          </div>
        ))}
      </div>
      <div className="stats"><Stat k="отброшено опоздавших" v={res.late.length ? res.late.join(', ') : 'нет'} /></div>
      <p className="small muted">События приходят не в том порядке, в котором случились (сеть, офлайн-телефоны, повторы). Watermark — утверждение «события старше этого момента больше не придут»; по нему окно закрывается и результат выдаётся. Маленькая задержка — быстрые, но неполные результаты; большая — полные, но поздние. Модель Dataflow (Akidau и др., 2015) делает этот компромисс явным: окна, триггеры, политика для опоздавших.</p>
    </Widget>
  );
}

// ---------- журнал транзакций таблицы в озере ----------
const LOG = [
  { v: 0, op: 'CREATE TABLE + INSERT', add: ['part-000.parquet', 'part-001.parquet'], remove: [] },
  { v: 1, op: 'INSERT (новые продажи)', add: ['part-002.parquet'], remove: [] },
  { v: 2, op: 'DELETE WHERE customer = 42', add: ['part-001-v2.parquet'], remove: ['part-001.parquet'] },
  { v: 3, op: 'OPTIMIZE (слить мелкие файлы)', add: ['part-big.parquet'], remove: ['part-000.parquet', 'part-001-v2.parquet', 'part-002.parquet'] },
];
function LakeLogWidget() {
  const [ver, setVer] = useState(3);
  const live = new Set();
  LOG.slice(0, ver + 1).forEach((e) => { e.add.forEach((f) => live.add(f)); e.remove.forEach((f) => live.delete(f)); });
  const allFiles = [...new Set(LOG.flatMap((e) => e.add))];
  return (
    <Widget title="Табличный формат поверх файлов: журнал версий (Delta Lake / Iceberg)">
      <Slider label="читаем версию таблицы" value={ver} min={0} max={3} onChange={setVer} />
      <div className="row">
        <div className="col">
          {LOG.map((e) => (
            <div key={e.v} className="mono small" style={{ opacity: e.v <= ver ? 1 : 0.35 }}>
              _delta_log/{String(e.v).padStart(20, '0')}.json — {e.op}<br />
              &nbsp;&nbsp;{e.add.map((f) => '+' + f).join(' ')} {e.remove.map((f) => '−' + f).join(' ')}
            </div>
          ))}
        </div>
        <div className="col">
          <p className="small"><b>Файлы в объектном хранилище:</b></p>
          {allFiles.map((f) => <div key={f} className="mono small" style={{ color: live.has(f) ? undefined : 'var(--muted)', textDecoration: live.has(f) ? undefined : 'line-through' }}>{f}{live.has(f) ? '  ✓ входит в версию' : ''}</div>)}
        </div>
      </div>
      <p className="small muted">Файлы данных неизменяемы. Состояние таблицы на версии N — это результат проигрывания журнала до N: какие файлы добавлены и какие логически удалены. Фиксация — атомарное создание следующего файла журнала (кто первый создал N+1 — тот и победил: оптимистичная конкурентность). Отсюда ACID-транзакции, «путешествие во времени» (<code>SELECT … VERSION AS OF 1</code>) и безопасное чтение во время записи. Старые файлы физически удаляются отдельной командой очистки.</p>
    </Widget>
  );
}

export default function BigData() {
  return (
    <>
      <h1>Большие данные: Data Lake, MapReduce, Spark, потоки</h1>
      <p className="lead">Когда данных петабайты, а их форма заранее неизвестна (логи, клики, события, тексты), классического хранилища недостаточно. Индустрия прошла путь от MapReduce к Spark, от «озера» к «лейкхаусу» и от пакетной обработки к потоковой.</p>

      <h2>Распределённая файловая система</h2>
      <p>
        Google File System <Cite id="ghemawat2003" /> и её открытый клон HDFS <Cite id="shvachko2010" />: файл делится на большие блоки (64–128 МБ), каждый хранится в трёх копиях на разных машинах из дешёвого железа; отдельный главный узел хранит метаданные. Отказ диска или машины — норма, а не исключение. Сегодня в облаке ту же роль играет объектное хранилище (S3, GCS).
      </p>

      <h2>MapReduce</h2>
      <p>
        Дин и Гемават <Cite id="dean2008" />: программист пишет только <code>map(k, v) → [(k′, v′)]</code> и <code>reduce(k′, [v′]) → результат</code>, а система распределяет работу по тысячам машин, перемещает данные (shuffle), перезапускает упавшие и медленные задачи. Вычисление отправляется к данным, а не наоборот.
      </p>
      <MapReduceWidget />
      <Code title="books/db/python/mapreduce.py" collapse>{mrSrc}</Code>
      <Code lang="bash" title="вывод python mapreduce.py (на Tiny Shakespeare)">{`
строк на входе: 40,000
подсчёт слов: 12,631 разных слов; пар в shuffle по reduce-задачам: [76462, 55934, 71666] (всего 204,062)
  топ-5: [('the', 6283), ('and', 5690), ('to', 4902), ('i', 4562), ('of', 3759)]
с комбайнером: пар в shuffle 25,513 — в 8.0 раза меньше трафика
инвертированный индекс: «romeo» встречается в 268 строках, первые: [15813, 15876, 15882, 15889, 15895]
результаты совпадают с однопоточным подсчётом ✓
`}</Code>
      <p>
        Писать всё на map и reduce неудобно, поэтому появился Hive <Cite id="thusoo2009" /> — SQL, транслируемый в цепочки MapReduce-задач, и понятие «хранилище данных на Hadoop». Слабость MapReduce — каждая стадия пишет результат на диск, и итеративные алгоритмы (машинное обучение, графы) работают медленно.
      </p>

      <h2>Spark</h2>
      <p>
        Захария и др. <Cite id="zaharia2012" /> предложили устойчивые распределённые наборы данных (RDD): неизменяемые разделённые коллекции, которые помнят свою <b>родословную</b> — цепочку преобразований, из которой их можно пересчитать. Промежуточные результаты держатся в памяти, а отказоустойчивость достигается пересчётом потерянных частей, а не репликацией. Spark SQL <Cite id="armbrust2015" /> добавил DataFrame и оптимизатор Catalyst — по сути реляционный движок (главы 8, 10) поверх кластера.
      </p>
      <Code lang="python" title="PySpark — подсчёт слов и аналитика над Parquet в озере">{`
from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.appName("demo").getOrCreate()

# тот же MapReduce, но выраженный через преобразования
words = (spark.read.text("s3://lake/raw/books/*.txt")
         .select(F.explode(F.split(F.lower("value"), r"[^a-z']+")).alias("word"))
         .where("word != ''")
         .groupBy("word").count()
         .orderBy(F.desc("count")))
words.show(5)

# SQL поверх Parquet: читаются только нужные колонки и партиции (date=...)
sales = spark.read.parquet("s3://lake/silver/sales/")
(sales.where("date >= '2024-01-01'")
      .groupBy("region").agg(F.sum("revenue").alias("revenue"))
      .write.mode("overwrite").parquet("s3://lake/gold/revenue_by_region/"))
`}</Code>

      <h2>Data Lake</h2>
      <p>
        <b>Озеро данных</b> — хранить всё, сырым, в дешёвом хранилище, в открытых форматах (Parquet, ORC, JSON), а структуру применять при чтении (schema-on-read). Плюсы — дёшево, ничего не теряется, данные доступны любому движку (Spark, Trino, Presto, DuckDB) и ML. Минусы первых озёр: нет транзакций (читатель видит наполовину записанные данные), нет обновлений и удалений (а их требует, например, GDPR), миллионы мелких файлов, отсутствие схемы превращает озеро в «болото».
      </p>
      <h3>Табличные форматы и Lakehouse</h3>
      <p>
        Решение — слой метаданных поверх файлов: Delta Lake <Cite id="armbrust2020" />, Apache Iceberg <Cite id="iceberg" />, Apache Hudi. Таблица — это набор неизменяемых Parquet-файлов плюс журнал/дерево метаданных, перечисляющее, какие файлы образуют каждую версию. Это даёт ACID-транзакции, снимки и «путешествие во времени», эволюцию схемы, пропуск файлов по статистике.
        Армбраст и др. <Cite id="armbrust2021" /> назвали архитектуру, где возможности хранилища данных реализованы прямо над озером, <b>lakehouse</b>.
      </p>
      <LakeLogWidget />
      <p>Распространённая организация слоёв («медальонная архитектура»): <b>bronze</b> — сырые данные как пришли; <b>silver</b> — очищенные, дедуплицированные, с нормальными типами; <b>gold</b> — агрегаты и витрины под отчёты и ML.</p>

      <h2>Потоковая обработка</h2>
      <p>
        Пакетная обработка отвечает «что было вчера». Для «что происходит сейчас» данные обрабатывают потоком. Основа — <b>распределённый журнал</b> Kafka <Cite id="wang2015kafka" />: темы делятся на партиции, каждая — упорядоченный реплицируемый журнал, в который дописывают; потребители читают в своём темпе, запоминая смещение. Это та же идея журнала, что в WAL (глава 13), но как общая шина данных компании. Изменения из OLTP-баз попадают в Kafka через <b>CDC</b> (change data capture) — чтение журнала СУБД.
      </p>
      <p>
        Обработчики потоков (Flink <Cite id="carbone2015" />, Spark Structured Streaming, Kafka Streams) поддерживают состояние, окна и точно-однократную обработку через согласованные контрольные точки состояния. Модель Dataflow <Cite id="akidau2015" /> (Google, основа Apache Beam) разделила вопросы: <i>что</i> считаем, <i>где</i> во времени события (окна), <i>когда</i> выдавать результат (watermark и триггеры) и <i>как</i> уточнять уже выданное.
      </p>
      <WindowWidget />
      <Callout type="note" title="Lambda и Kappa">
        <p><b>Lambda-архитектура</b>: пакетный слой считает точно, но с опозданием; потоковый — быстро, но приближённо; результаты объединяются. Две реализации одной логики — дорого поддерживать. <b>Kappa-архитектура</b>: только поток; пересчёт истории — это повторное проигрывание журнала с начала. Современные движки (Flink, Spark) позволяют писать одну логику для обоих режимов.</p>
      </Callout>

      <h2>Карта ландшафта</h2>
      <table>
        <thead><tr><th>Задача</th><th>Инструменты</th></tr></thead>
        <tbody>
          <tr><td>Хранение сырья и истории</td><td>S3/GCS/HDFS + Parquet; табличные форматы Iceberg, Delta, Hudi</td></tr>
          <tr><td>Пакетная обработка</td><td>Spark, dbt + SQL в хранилище, (исторически) MapReduce/Hive</td></tr>
          <tr><td>Интерактивный SQL по озеру</td><td>Trino/Presto, Spark SQL, BigQuery, Snowflake, DuckDB</td></tr>
          <tr><td>Поток событий</td><td>Kafka, Pulsar, Kinesis; CDC — Debezium</td></tr>
          <tr><td>Потоковая обработка</td><td>Flink, Spark Structured Streaming, Kafka Streams</td></tr>
          <tr><td>Оркестрация конвейеров</td><td>Airflow, Dagster</td></tr>
        </tbody>
      </table>
      <Quiz q="Чем Spark принципиально отличается от MapReduce?" options={['Spark не распределённый', 'Промежуточные данные держатся в памяти, а отказоустойчивость — через пересчёт по родословной RDD, а не запись каждой стадии на диск', 'Spark не умеет SQL', 'MapReduce быстрее для итеративных алгоритмов']} answer={1}
        explain="Отсюда выигрыш на порядки для итеративных задач и интерактивных запросов." />
      <Quiz q="Что добавляет табличный формат (Delta, Iceberg) к набору Parquet-файлов?" options={['Сжатие', 'Журнал/метаданные версий: ACID-транзакции, снимки, удаления и обновления, эволюцию схемы', 'Колоночное хранение', 'Индексы B+-деревьев']} answer={1}
        explain="Сами файлы остаются неизменяемыми Parquet; транзакционность даёт слой метаданных." />
      <Quiz q="Зачем нужен watermark в потоковой обработке?" options={['Для шифрования', 'Чтобы решить, когда окно по времени события можно закрыть и выдать результат, несмотря на опаздывающие события', 'Чтобы сжимать поток', 'Для балансировки партиций']} answer={1}
        explain="Без него непонятно, ждать ли ещё событий за прошедшую минуту." />
    </>
  );
}
