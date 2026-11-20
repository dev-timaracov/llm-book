import React, { useMemo, useState } from 'react';
import { M, Cite, Callout, Code, Quiz, Widget, Stat, fmt } from '@shared/ui.jsx';
import { makeRng } from '@shared/rng.js';

const DIMS = {
  time: ['year', 'quarter', 'month'],
  geo: ['region', 'city'],
  product: ['category', 'product'],
};
const CITIES = { 'Центр': ['Москва', 'Тула'], 'Поволжье': ['Казань', 'Самара'], 'Урал': ['Пермь', 'Екатеринбург'] };
const PRODUCTS = { 'Электроника': ['Ноутбук', 'Телефон'], 'Книги': ['Роман', 'Учебник'] };

function makeFacts() {
  const rng = makeRng(17), out = [];
  for (const year of [2023, 2024]) for (let month = 1; month <= 12; month++)
    for (const [region, cities] of Object.entries(CITIES)) for (const city of cities)
      for (const [category, prods] of Object.entries(PRODUCTS)) for (const product of prods) {
        const base = category === 'Электроника' ? 400 : 60;
        const growth = year === 2024 ? 1.15 : 1;
        const season = month >= 11 ? 1.6 : 1;
        out.push({ year, quarter: `Q${Math.ceil(month / 3)}`, month: String(month).padStart(2, '0'), region, city, category, product, revenue: Math.round(base * growth * season * (0.6 + rng.rand() * 0.8)) });
      }
  return out;
}

function CubeWidget() {
  const facts = useMemo(makeFacts, []);
  const [lvl, setLvl] = useState({ time: 0, geo: 0, product: 0 });
  const [rowsDim, setRowsDim] = useState('geo');
  const [colsDim, setColsDim] = useState('time');
  const [slice, setSlice] = useState('все');
  const rowKey = DIMS[rowsDim][lvl[rowsDim]], colKey = DIMS[colsDim][lvl[colsDim]];
  const otherDim = Object.keys(DIMS).find((d) => d !== rowsDim && d !== colsDim);
  const sliceKey = DIMS[otherDim][0];
  const sliceVals = ['все', ...new Set(facts.map((f) => f[sliceKey]))];
  const data = facts.filter((f) => slice === 'все' || String(f[sliceKey]) === String(slice));
  const rowVals = [...new Set(data.map((f) => f[rowKey]))].sort();
  const colVals = [...new Set(data.map((f) => f[colKey]))].sort();
  const cell = {}; data.forEach((f) => { const k = f[rowKey] + '|' + f[colKey]; cell[k] = (cell[k] || 0) + f.revenue; });
  const rowTot = (rv) => colVals.reduce((s, cv) => s + (cell[rv + '|' + cv] || 0), 0);
  const colTot = (cv) => rowVals.reduce((s, rv) => s + (cell[rv + '|' + cv] || 0), 0);
  const total = rowVals.reduce((s, rv) => s + rowTot(rv), 0);
  const names = { time: 'время', geo: 'география', product: 'товар' };
  const btn = (d, delta, label) => <button className="btn small" disabled={lvl[d] + delta < 0 || lvl[d] + delta >= DIMS[d].length} onClick={() => setLvl({ ...lvl, [d]: lvl[d] + delta })}>{label}</button>;
  return (
    <Widget title="OLAP-куб продаж: срез, детализация, свёртка, поворот">
      <div className="controls small">
        {Object.keys(DIMS).map((d) => (
          <span key={d}><b>{names[d]}</b>: {DIMS[d][lvl[d]]} {btn(d, 1, 'drill-down ↓')} {btn(d, -1, 'roll-up ↑')}</span>
        ))}
      </div>
      <div className="controls small">
        строки: <select value={rowsDim} onChange={(e) => { if (e.target.value === colsDim) setColsDim(rowsDim); setRowsDim(e.target.value); setSlice('все'); }}>{Object.keys(DIMS).map((d) => <option key={d} value={d}>{names[d]}</option>)}</select>
        столбцы: <select value={colsDim} onChange={(e) => { if (e.target.value === rowsDim) setRowsDim(colsDim); setColsDim(e.target.value); setSlice('все'); }}>{Object.keys(DIMS).map((d) => <option key={d} value={d}>{names[d]}</option>)}</select>
        <button className="btn small" onClick={() => { setRowsDim(colsDim); setColsDim(rowsDim); }}>pivot ⇄</button>
        срез ({sliceKey}): <select value={slice} onChange={(e) => setSlice(e.target.value)}>{sliceVals.map((v) => <option key={v}>{v}</option>)}</select>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="small">
          <thead><tr><th>{rowKey} \ {colKey}</th>{colVals.map((c) => <th key={c}>{c}</th>)}<th>итого</th></tr></thead>
          <tbody>
            {rowVals.map((rv) => <tr key={rv}><th>{rv}</th>{colVals.map((cv) => <td key={cv} className="mono">{fmt((cell[rv + '|' + cv] || 0) / 1000, 1)}</td>)}<td className="mono"><b>{fmt(rowTot(rv) / 1000, 1)}</b></td></tr>)}
            <tr><th>итого</th>{colVals.map((cv) => <td key={cv} className="mono"><b>{fmt(colTot(cv) / 1000, 1)}</b></td>)}<td className="mono"><b>{fmt(total / 1000, 1)}</b></td></tr>
          </tbody>
        </table>
      </div>
      <div className="stats"><Stat k="строк фактов" v={facts.length} /><Stat k="после среза" v={data.length} /></div>
      <p className="small muted">Выручка в тысячах. Каждая клетка — <code>SUM(revenue) … GROUP BY {rowKey}, {colKey}</code>; строки и столбцы «итого» — то, что одним запросом даёт <code>GROUP BY CUBE</code>/<code>ROLLUP</code>. В ноябре–декабре виден сезонный рост, в 2024 году — общий рост на ~15%.</p>
    </Widget>
  );
}

function SCDWidget() {
  const [moved, setMoved] = useState(false);
  const [type, setType] = useState(2);
  const rows2 = moved
    ? [[1, 42, 'Аня', 'Казань', '2020-01-01', '2024-05-31', 'нет'], [2, 42, 'Аня', 'Москва', '2024-06-01', '9999-12-31', 'да']]
    : [[1, 42, 'Аня', 'Казань', '2020-01-01', '9999-12-31', 'да']];
  const rows1 = [[1, 42, 'Аня', moved ? 'Москва' : 'Казань']];
  return (
    <Widget title="Медленно меняющиеся измерения (SCD)">
      <div className="controls">
        <button className={'btn small' + (type === 1 ? ' primary' : '')} onClick={() => setType(1)}>тип 1: перезаписать</button>
        <button className={'btn small' + (type === 2 ? ' primary' : '')} onClick={() => setType(2)}>тип 2: хранить историю</button>
        <button className="btn" onClick={() => setMoved(!moved)}>{moved ? 'отменить переезд' : 'Аня переехала в Москву 1 июня 2024'}</button>
      </div>
      <table className="small">
        <thead><tr>{(type === 2 ? ['customer_key', 'customer_id', 'name', 'city', 'valid_from', 'valid_to', 'текущая'] : ['customer_key', 'customer_id', 'name', 'city']).map((c) => <th key={c} className="mono">{c}</th>)}</tr></thead>
        <tbody>{(type === 2 ? rows2 : rows1).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="mono">{v}</td>)}</tr>)}</tbody>
      </table>
      <p className="small">{type === 1
        ? 'Тип 1: город просто перезаписан. Все прошлые продажи Ани теперь «случились в Москве» — отчёт за 2023 год по регионам изменится задним числом.'
        : 'Тип 2: новая версия строки с новым суррогатным ключом. Факты продаж ссылаются на customer_key, действовавший в момент продажи, — продажи до июня остаются казанскими, после — московскими.'}</p>
    </Widget>
  );
}

export default function OLAPDWH() {
  return (
    <>
      <h1>OLTP, OLAP и хранилища данных</h1>
      <p className="lead">Одна и та же компания задаёт базам данных два совершенно разных вида вопросов: «оформи заказ №1017» и «как менялась выручка по регионам за три года». Под них строят разные системы — и мост между ними.</p>

      <h2>Две нагрузки</h2>
      <table>
        <thead><tr><th></th><th>OLTP (online transaction processing)</th><th>OLAP (online analytical processing)</th></tr></thead>
        <tbody>
          <tr><td>Кто</td><td>приложения, тысячи пользователей</td><td>аналитики, отчёты, дашборды, ML</td></tr>
          <tr><td>Запрос</td><td>прочитать/изменить несколько строк по ключу</td><td>просканировать и агрегировать миллионы–миллиарды строк</td></tr>
          <tr><td>Важно</td><td>задержка (мс), конкурентность, целостность</td><td>пропускная способность сканирования, время ответа на сложный запрос (с–мин)</td></tr>
          <tr><td>Данные</td><td>текущее состояние, ГБ–ТБ</td><td>история за годы из многих источников, ТБ–ПБ</td></tr>
          <tr><td>Схема</td><td>нормализованная (глава 2)</td><td>денормализованная: «звезда», широкие таблицы</td></tr>
          <tr><td>Хранение</td><td>строки, B+-деревья, MVCC (главы 3–13)</td><td>колонки, сжатие, векторное исполнение, MPP (главы 5, 17)</td></tr>
          <tr><td>Примеры</td><td>PostgreSQL, MySQL, Oracle</td><td>ClickHouse, Snowflake, BigQuery, Redshift, Greenplum</td></tr>
        </tbody>
      </table>
      <p>Если запускать тяжёлую аналитику на рабочей OLTP-базе, она выедает ресурсы у транзакций, а данные из других систем туда всё равно не попадут. Отсюда — отдельное хранилище. Классический обзор технологий хранилищ данных и OLAP — Чаудхури и Даял <Cite id="chaudhuri1997" />.</p>

      <h2>Хранилище данных (DWH)</h2>
      <p>По классическому определению Инмона, хранилище данных — <b>предметно-ориентированная, интегрированная, привязанная ко времени и неизменяемая</b> коллекция данных для поддержки принятия решений. На практике это:</p>
      <ol>
        <li><b>Источники</b>: OLTP-базы, CRM, логи, внешние файлы.</li>
        <li><b>ETL / ELT</b>: извлечь (extract), преобразовать (transform: очистить, привести к общим справочникам, объединить), загрузить (load). Классический ETL преобразует до загрузки; в облачных хранилищах популярнее ELT — загрузить сырые данные и преобразовывать уже SQL внутри хранилища (dbt).</li>
        <li><b>Слои</b>: сырые данные (staging) → очищенная интегрированная модель → витрины (data marts) под конкретные отделы и отчёты.</li>
        <li><b>Потребители</b>: BI-инструменты, отчёты, ad-hoc SQL, выгрузки для ML.</li>
      </ol>
      <p>Два подхода к проектированию: <b>Инмон</b> — сначала нормализованное корпоративное хранилище, из него витрины; <b>Кимбалл</b> — сразу набор согласованных «звёздных» витрин с общими измерениями. Плюс более поздний подход Data Vault — хабы, связи и сателлиты для гибкой интеграции множества источников.</p>

      <h2>Многомерное моделирование</h2>
      <p>Центральная таблица <b>фактов</b> — события бизнес-процесса с числовыми мерами (продажа: количество, сумма); вокруг — таблицы <b>измерений</b> — контекст событий (когда, где, что, кто). Первое решение — <b>зерно</b>: что такое одна строка фактов (позиция чека? день по магазину?).</p>
      <svg viewBox="0 0 520 260" className="diagram" role="img" aria-label="Схема звезда" style={{ maxWidth: 520 }}>
        {[['dim_date', 'date_key, date, month, quarter, year, is_holiday', 20, 20], ['dim_store', 'store_key, city, region, format', 340, 20], ['dim_product', 'product_key, name, category, brand', 20, 190], ['dim_customer', 'customer_key, city, segment, valid_from/to', 340, 190]].map(([n, c, x, y]) => (
          <g key={n}><rect x={x} y={y} width={160} height={52} rx={8} className="box hl3" /><text x={x + 80} y={y + 20} textAnchor="middle" fontWeight="600">{n}</text><text x={x + 80} y={y + 38} textAnchor="middle" className="sm" style={{ fontSize: 9 }}>{c}</text>
            <line x1={x + 80} y1={y < 100 ? y + 52 : y} x2={260} y2={y < 100 ? 100 : 160} /></g>
        ))}
        <rect x={175} y={100} width={170} height={60} rx={8} className="box hl" />
        <text x={260} y={122} textAnchor="middle" fontWeight="700">fact_sales</text>
        <text x={260} y={140} textAnchor="middle" className="sm">ключи измерений + qty, revenue</text>
        <text x={260} y={153} textAnchor="middle" className="sm">миллиарды строк</text>
      </svg>
      <ul>
        <li><b>«Звезда»</b>: измерения денормализованы (город и регион в одной таблице) — запросы проще и быстрее, одно соединение на измерение. <b>«Снежинка»</b>: измерения нормализованы (регион — отдельная таблица) — меньше дублирования, больше соединений.</li>
        <li><b>Меры</b>: аддитивные (выручку можно суммировать по любым измерениям), полуаддитивные (остаток на счёте нельзя суммировать по времени), неаддитивные (цена, процент — нужно пересчитывать из компонент).</li>
        <li><b>Суррогатные ключи</b> измерений отвязывают хранилище от ключей источников и позволяют хранить историю.</li>
      </ul>
      <SCDWidget />

      <h2>OLAP-операции и куб</h2>
      <p>Данные удобно представлять кубом: оси — измерения, в клетках — меры. Операции: <b>срез</b> (slice — зафиксировать значение измерения), <b>кубик</b> (dice — диапазоны по нескольким), <b>детализация</b> (drill-down — с года на квартал), <b>свёртка</b> (roll-up — обратно), <b>поворот</b> (pivot).</p>
      <CubeWidget />
      <p>
        Грей и др. <Cite id="gray1997" /> предложили оператор <code>CUBE</code>, обобщающий GROUP BY: он считает агрегаты по всем <M t="2^n" /> подмножествам измерений сразу (с подитогами и общим итогом); <code>ROLLUP</code> — только по иерархии; <code>GROUPING SETS</code> — по явно перечисленным наборам. Все три вошли в стандарт SQL. Предвычислять весь куб дорого, поэтому выбирают, какие агрегаты материализовать, — классический жадный алгоритм Харинараяна, Раджарамана и Ульмана <Cite id="harinarayan1996" />.
      </p>
      <Code lang="sql" title="SQL — звезда и подытоги одним запросом (PostgreSQL)">{`
SELECT d.year, s.region, p.category, sum(f.revenue) AS revenue,
       GROUPING(d.year, s.region, p.category) AS level   -- какие колонки «свёрнуты» в итог
FROM fact_sales f
JOIN dim_date d    ON d.date_key = f.date_key
JOIN dim_store s   ON s.store_key = f.store_key
JOIN dim_product p ON p.product_key = f.product_key
WHERE d.year IN (2023, 2024)
GROUP BY ROLLUP (d.year, s.region, p.category)          -- год → год+регион → год+регион+категория + общий итог
ORDER BY d.year, s.region, p.category;

-- материализованное представление — заранее посчитанная «грань» куба
CREATE MATERIALIZED VIEW sales_by_month_region AS
SELECT d.year, d.month, s.region, sum(f.revenue) AS revenue
FROM fact_sales f JOIN dim_date d USING (date_key) JOIN dim_store s USING (store_key)
GROUP BY 1, 2, 3;
`}</Code>

      <h2>Как устроены аналитические СУБД</h2>
      <ul>
        <li><b>MPP</b> (massively parallel processing): данные распределены по узлам (по хешу ключа), каждый узел сканирует свою часть, частичные агрегаты сливаются. Соединения требуют перераспределения (shuffle) или копирования маленьких измерений на все узлы (broadcast).</li>
        <li>Колоночное хранение и сжатие (главы 5, 17), zone maps вместо индексов, векторное исполнение (глава 8).</li>
        <li>Исторически — MOLAP (специализированные многомерные массивы), ROLAP (реляционная звезда + SQL), HOLAP (гибрид). Колоночные СУБД сделали ROLAP настолько быстрым, что отдельные MOLAP-кубы почти ушли.</li>
        <li>Сравнивают системы стандартными бенчмарками: TPC-H <Cite id="tpch" /> (22 запроса над схемой «заказы — поставщики») и TPC-DS.</li>
      </ul>

      <h2>HTAP: стереть границу</h2>
      <p>ETL означает задержку: аналитика видит данные часами позже. Гибридные системы HTAP <Cite id="ozcan2017" /> выполняют обе нагрузки над одними данными: строчное хранилище для транзакций и колоночная копия, которая обновляется из журнала (TiDB + TiFlash, SQL Server с колоночными индексами, Oracle In-Memory, SingleStore). Альтернатива — поток изменений (CDC) из OLTP-журнала прямо в хранилище с задержкой в секунды (глава 22).</p>
      <Quiz q="Остаток на складе по дням — какая это мера?" options={['Аддитивная', 'Полуаддитивная: суммировать по складам можно, по дням — нельзя', 'Неаддитивная', 'Это измерение']} answer={1}
        explain="Сумма остатков за 30 дней не имеет смысла; по времени берут последнее значение или среднее." />
      <Quiz q="Зачем в хранилище SCD типа 2?" options={['Экономить место', 'Чтобы факты прошлого оставались привязаны к атрибутам измерения, действовавшим в момент события', 'Чтобы ускорить ETL', 'Это требование колоночных СУБД']} answer={1}
        explain="Иначе изменение справочника задним числом перекраивает исторические отчёты." />
    </>
  );
}
