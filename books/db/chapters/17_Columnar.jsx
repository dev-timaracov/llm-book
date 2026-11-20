import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Stat, Slider, fmt } from '@shared/ui.jsx';

const COLS = {
  date: ['01-03', '01-03', '01-04', '01-04', '01-05', '01-05', '01-06', '01-06'],
  region: ['EU', 'US', 'EU', 'EU', 'US', 'EU', 'US', 'EU'],
  amount: [120, 300, 80, 450, 90, 600, 210, 50],
  customer: ['Аня', 'Bob', 'Борис', 'Вера', 'Carl', 'Глеб', 'Dana', 'Даша'],
};

function LateMaterialization() {
  const [step, setStep] = useState(0);
  const p1 = COLS.region.map((v, i) => (v === 'EU' ? i : -1)).filter((i) => i >= 0);
  const p2 = p1.filter((i) => COLS.amount[i] > 100);
  const steps = [
    { title: '1. Сканируем колонку region, получаем список позиций, где region = EU', active: ['region'], pos: p1, read: { region: 8 } },
    { title: '2. Из колонки amount читаем только позиции из списка и фильтруем amount > 100', active: ['amount'], pos: p2, read: { region: 8, amount: p1.length } },
    { title: '3. Только для итоговых позиций достаём customer — «склеиваем» строки в самом конце', active: ['customer'], pos: p2, read: { region: 8, amount: p1.length, customer: p2.length } },
  ];
  const st = steps[step];
  const total = Object.values(st.read).reduce((a, b) => a + b, 0);
  return (
    <Widget title="Позднее склеивание строк: SELECT customer WHERE region = 'EU' AND amount > 100">
      <div className="controls">
        <button className="btn" onClick={() => setStep(Math.max(0, step - 1))}>← назад</button>
        <button className="btn primary" onClick={() => setStep(Math.min(2, step + 1))}>шаг →</button>
        <span className="small"><b>{st.title}</b></span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Object.entries(COLS).map(([name, vals]) => (
          <div key={name} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', opacity: st.read[name] !== undefined || st.active.includes(name) ? 1 : 0.4 }}>
            <div className="mono small" style={{ padding: '2px 8px', background: st.active.includes(name) ? 'var(--accent-soft)' : 'var(--bg-soft)', fontWeight: 600 }}>{name}</div>
            {vals.map((v, i) => <div key={i} className="mono small" style={{ padding: '1px 8px', background: st.pos.includes(i) && (st.read[name] !== undefined) ? 'var(--amber-soft)' : undefined }}>{v}</div>)}
          </div>
        ))}
        <div className="small" style={{ alignSelf: 'center' }}>позиции: <span className="mono">[{st.pos.join(', ')}]</span></div>
      </div>
      <div className="stats"><Stat k="прочитано значений" v={total} /><Stat k="при чтении строк целиком" v={8 * 4} /></div>
      <p className="small muted">Колонку date не трогаем вовсе. Между операторами путешествуют компактные списки позиций (или битовые маски), а не широкие строки. Когда фильтры отбрасывают почти всё, выигрыш огромный; если результат — большая доля строк, раннее склеивание может оказаться не хуже.</p>
    </Widget>
  );
}

function ParquetDiagram() {
  return (
    <svg viewBox="0 0 640 250" className="diagram" role="img" aria-label="Устройство файла Parquet" style={{ maxWidth: 640 }}>
      <rect x={10} y={10} width={620} height={230} rx={10} className="box" />
      <text x={20} y={30} fontWeight="600">файл .parquet</text>
      {[0, 1].map((g) => (
        <g key={g}>
          <rect x={20 + g * 250} y={42} width={240} height={150} rx={8} className="box hl" />
          <text x={30 + g * 250} y={60} fontWeight="600">группа строк {g + 1} (≈ 100 тыс.–1 млн строк)</text>
          {['date', 'region', 'amount'].map((c, i) => (
            <g key={c}>
              <rect x={30 + g * 250} y={70 + i * 40} width={220} height={34} rx={6} className="box hl2" />
              <text x={40 + g * 250} y={86 + i * 40} fontSize="12">колонка {c}: страницы</text>
              <text x={40 + g * 250} y={99 + i * 40} className="sm">кодирование + сжатие, min/max</text>
            </g>
          ))}
        </g>
      ))}
      <rect x={520} y={42} width={100} height={150} rx={8} className="box hl4" />
      <text x={570} y={100} textAnchor="middle" fontWeight="600">footer</text>
      <text x={570} y={118} textAnchor="middle" className="sm">схема,</text>
      <text x={570} y={132} textAnchor="middle" className="sm">смещения,</text>
      <text x={570} y={146} textAnchor="middle" className="sm">статистика</text>
      <text x={320} y={220} textAnchor="middle" className="sm">читатель сначала читает footer, затем — только нужные колонки и только группы, чьи min/max пересекаются с фильтром</text>
    </svg>
  );
}

function VectorizedWidget() {
  const [vec, setVec] = useState(1024);
  const rows = 1e9;
  const callCost = 10, workCost = 1; // нс: накладные расходы интерпретации на вызов vs работа на значение
  const t = (rows / vec) * callCost + rows * workCost;
  return (
    <Widget title="Построчно или векторами: доля накладных расходов">
      <Slider label="значений за один вызов next()" value={vec} min={1} max={4096} onChange={setVec} />
      <div className="stats">
        <Stat k="время на 1 млрд значений" v={fmt(t / 1e9, 2) + ' с'} />
        <Stat k="доля накладных расходов" v={fmt((100 * (rows / vec) * callCost) / t, 1) + '%'} />
      </div>
      <p className="small muted">Модель: ~10 нс на вызов оператора (виртуальный вызов, ветвления, интерпретация выражения) и ~1 нс полезной работы на значение (порядки величин условные). При построчной обработке (1 значение за вызов) накладные расходы — 90% времени. Вектор из ~1000 значений делает их пренебрежимыми и позволяет компилятору и процессору использовать SIMD — идея MonetDB/X100 (Boncz и др., 2005). Слишком большой вектор перестаёт помещаться в кэш процессора, поэтому на практике берут 1–2 тысячи.</p>
    </Widget>
  );
}

export default function Columnar() {
  return (
    <>
      <h1>Колоночные СУБД</h1>
      <p className="lead">ClickHouse, DuckDB, Snowflake, BigQuery, Vertica, Redshift — все аналитические СУБД последних двадцати лет колоночные. Разберём, из чего складывается их скорость: хранение, сжатие, исполнение и обновления.</p>

      <h2>История</h2>
      <p>
        Идея хранить таблицу по столбцам старше реляционных СУБД, но массовой она стала после MonetDB и C-Store <Cite id="stonebraker2005cstore" /> (коммерчески — Vertica <Cite id="lamb2012" />). Абади, Мэдден и Хашем <Cite id="abadi2008" /> разобрали, что именно даёт выигрыш, а обзор Абади и др. <Cite id="abadi2013" /> подробно описывает всю область. В 2010-е идеи перешли в облачные хранилища (Dremel/BigQuery <Cite id="melnik2010" />, Snowflake <Cite id="dageville2016" />), открытые форматы файлов (Parquet <Cite id="parquet" />, ORC), ClickHouse <Cite id="schulze2024" /> и встраиваемый DuckDB <Cite id="raasveldt2019" />.
      </p>

      <h2>Четыре источника скорости</h2>
      <ol>
        <li><b>Читаем только нужные колонки</b> (глава 3): запрос по 3 из 100 колонок читает ~3% данных.</li>
        <li><b>Сжатие</b> (глава 5): однородные данные сжимаются в разы, а часть операторов работает прямо на сжатых данных.</li>
        <li><b>Позднее склеивание строк</b>: операторы обмениваются позициями, значения других колонок подтягиваются только для прошедших фильтр строк.</li>
        <li><b>Векторное исполнение</b> (глава 8): операторы обрабатывают пачки значений по ~1000, без накладных расходов на каждую строку <Cite id="boncz2005" />, либо план компилируется в машинный код <Cite id="neumann2011" />.</li>
      </ol>
      <LateMaterialization />
      <VectorizedWidget />

      <h2>Порядок сортировки и индексы</h2>
      <p>
        В колоночных СУБД почти нет B+-деревьев. Вместо этого данные <b>физически упорядочены</b> по выбранному ключу, а на блоки строятся «разреженные» индексы:
      </p>
      <ul>
        <li><b>C-Store/Vertica</b>: одна таблица может храниться несколькими «проекциями» — наборами колонок с разными порядками сортировки; оптимизатор выбирает подходящую.</li>
        <li><b>ClickHouse, движок MergeTree</b> <Cite id="schulze2024" />: данные записываются неизменяемыми «кусками» (parts), отсортированными по ключу сортировки; фоновый процесс сливает куски — та же идея, что в LSM (глава 7). Первичный индекс хранит ключ каждой 8192-й строки («засечки»): поиск по диапазону ключа читает только нужные гранулы.</li>
        <li><b>Zone maps / min-max индексы</b> (глава 5) — в Parquet, Snowflake, Redshift, DuckDB.</li>
      </ul>

      <h2>Обновления</h2>
      <p>
        Вставить одну строку в колоночное хранилище — значит дописать по значению в каждый из сотни сжатых файлов; изменить строку — переписать сжатые блоки. Поэтому почти все колоночные системы двухуровневые:
        маленькое <b>хранилище для записи</b> (в памяти или строчное — WOS в C-Store) и большое <b>хранилище для чтения</b> (ROS), куда данные периодически переливаются пачками. Удаления и обновления — это метки удаления (битовые карты) и новые версии строк, которые убираются при слиянии. Это прямые родственники LSM-деревьев и MVCC.
      </p>

      <h2>Открытые форматы: Parquet</h2>
      <ParquetDiagram />
      <p>
        Parquet <Cite id="parquet" /> — де-факто стандарт хранения аналитических данных в файлах: столбцы внутри групп строк, на каждую колонку — словарное/RLE/дельта-кодирование и сжатие (Snappy, zstd), статистика min/max и количество NULL. Вложенные структуры (JSON-подобные записи с массивами) раскладываются по колонкам с помощью уровней повторения и определения из Dremel <Cite id="melnik2010" />. Parquet читают Spark, Trino, DuckDB, ClickHouse, Snowflake, pandas — это основа озёр данных (глава 22).
      </p>
      <Code lang="sql" title="DuckDB — SQL прямо по Parquet-файлам, без загрузки">{`
-- DuckDB читает только нужные колонки и группы строк (по статистике min/max в footer)
SELECT region, sum(amount) AS revenue
FROM 'sales/*.parquet'
WHERE date >= DATE '2024-01-01'
GROUP BY region
ORDER BY revenue DESC;

-- посмотреть устройство файла: группы строк, кодирование, статистику
SELECT * FROM parquet_metadata('sales/2024-01.parquet');
`}</Code>
      <Callout type="note" title="Когда колоночная СУБД — плохой выбор">
        <p>Частые точечные запросы «строка по ключу» и мелкие транзакционные обновления: колоночная система соберёт строку из десятков файлов и будет постоянно переписывать блоки. Для этого существуют OLTP-системы, а для смешанной нагрузки — гибриды HTAP (глава 21).</p>
      </Callout>
      <Quiz q="Что такое позднее склеивание строк (late materialization)?" options={['Строки сохраняются на диск с задержкой', 'Операторы передают позиции строк, а значения остальных колонок читаются только для строк, прошедших фильтры', 'Колонки сортируются после загрузки', 'Сжатие выполняется в фоне']} answer={1}
        explain="Так колонки, нужные только для вывода, читаются для малой доли строк." />
      <Quiz q="Почему MergeTree в ClickHouse похож на LSM-дерево?" options={['Использует Bloom-фильтры', 'Записи складываются в неизменяемые отсортированные куски, которые фоново сливаются', 'Использует B+-деревья', 'Хранит данные в памяти']} answer={1}
        explain="Неизменяемые отсортированные части + фоновое слияние — общая идея обеих структур." />
    </>
  );
}
