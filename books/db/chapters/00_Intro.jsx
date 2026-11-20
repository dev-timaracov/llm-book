import React from 'react';
import { Cite, Callout, Code } from '@shared/ui.jsx';

function Architecture() {
  const layers = [
    ['SQL-запрос', 'SELECT … FROM … WHERE …', 'box', ''],
    ['Парсер и планировщик', 'разбор, проверка, переписывание', 'hl4', 'гл. 10'],
    ['Оптимизатор', 'выбор плана по стоимости', 'hl4', 'гл. 10'],
    ['Исполнитель', 'операторы: scan, join, sort, aggregate', 'hl', 'гл. 8'],
    ['Методы доступа', 'таблицы-кучи, B+-деревья, LSM, хеши', 'hl2', 'гл. 6–7'],
    ['Буферный пул', 'кэш страниц в памяти', 'hl3', 'гл. 4'],
    ['Диск', 'файлы со страницами по 4–16 КБ', 'box', 'гл. 3'],
  ];
  return (
    <svg viewBox="0 0 640 400" className="diagram" role="img" aria-label="Архитектура СУБД" style={{ maxWidth: 620 }}>
      {layers.map(([t, s, cls, ch], i) => (
        <g key={i}>
          <rect x={20} y={10 + i * 54} width={400} height={44} rx={8} className={'box ' + cls} />
          <text x={36} y={30 + i * 54} fontWeight="600">{t}</text>
          <text x={36} y={46 + i * 54} className="sm">{s}</text>
          <text x={408} y={37 + i * 54} textAnchor="end" className="sm">{ch}</text>
        </g>
      ))}
      <rect x={440} y={172} width={180} height={206} rx={8} className="box hl3" />
      <text x={530} y={196} textAnchor="middle" fontWeight="600">Транзакции</text>
      <text x={530} y={216} textAnchor="middle" className="sm">блокировки, MVCC (гл. 11–12)</text>
      <text x={530} y={262} textAnchor="middle" fontWeight="600">Журнал (WAL)</text>
      <text x={530} y={282} textAnchor="middle" className="sm">восстановление (гл. 13)</text>
      <text x={530} y={330} textAnchor="middle" fontWeight="600">Репликация</text>
      <text x={530} y={350} textAnchor="middle" className="sm">распределённость (гл. 14)</text>
    </svg>
  );
}

export default function Intro() {
  return (
    <>
      <h1>Карта пути</h1>
      <p className="lead">
        Как СУБД превращает строку SQL в ответ за миллисекунды, почему ничего не теряется при отключении питания и как сотни клиентов пишут
        в одну таблицу одновременно. В этом учебнике мы пройдём путь запроса от SQL до байтов на диске и обратно, а в конце напишем свои B+-дерево, LSM-хранилище, движок запросов и MVCC.
      </p>

      <h2>Что делает система управления базами данных</h2>
      <p>Хранить данные в файле умеет любая программа. СУБД отличается тем, что даёт четыре гарантии одновременно:</p>
      <ul>
        <li><b>Абстракция данных.</b> Вы описываете, <i>что</i> нужно получить (SQL), а не <i>как</i> его искать. Эту идею <b>независимости данных</b> предложил Кодд в 1970 году, построив реляционную модель <Cite id="codd1970" />. Первые реализации — System R в IBM <Cite id="astrahan1976" /> (из неё вышел язык SEQUEL/SQL <Cite id="chamberlin1974" />) и INGRES в Беркли <Cite id="stonebraker1976" />.</li>
        <li><b>Эффективность.</b> Данных больше, чем памяти. СУБД держит на диске структуры (индексы), которые позволяют найти одну запись среди миллиардов за несколько чтений.</li>
        <li><b>Конкурентность.</b> Много клиентов работают одновременно, но каждый видит базу так, будто он один.</li>
        <li><b>Надёжность.</b> Подтверждённая запись переживёт сбой процесса, ядра или питания.</li>
      </ul>

      <h2>Архитектура</h2>
      <p>Почти все СУБД — PostgreSQL, MySQL, SQLite, Oracle, SQL Server — устроены по одной схеме <Cite id="hellerstein2007" />. Мы пройдём её снизу вверх:</p>
      <Architecture />
      <Callout type="tip" title="Главная мысль учебника">
        <p>Почти каждое проектное решение в СУБД объясняется одним фактом: <b>доступ к диску на порядки медленнее доступа к памяти, а случайный доступ медленнее последовательного</b>. Страницы, буферный пул, B+-деревья, LSM, журнал, колоночное хранение — разные ответы на этот факт.</p>
      </Callout>

      <h2>Маршрут</h2>
      <table>
        <thead><tr><th>Часть</th><th>Главы</th><th>Что напишете сами</th></tr></thead>
        <tbody>
          <tr><td>I. Модель данных</td><td>1. SQL и реляционная алгебра · 2. Нормализация и проектирование схем</td><td><code>normalize.py</code></td></tr>
          <tr><td>II. Хранение</td><td>3. Диск, страницы, записи · 4. Буферный пул · 5. Сжатие колонок</td><td><code>colcompress.py</code></td></tr>
          <tr><td>III. Индексы</td><td>6. B+-деревья и хеш-индексы · 7. LSM-деревья и Bloom-фильтры</td><td><code>btree.py</code>, <code>lsm.py</code></td></tr>
          <tr><td>IV. Запросы</td><td>8. Выполнение · 9. Внешняя сортировка · 10. Оптимизатор</td><td><code>query.py</code>, <code>extsort.py</code></td></tr>
          <tr><td>V. Транзакции</td><td>11. ACID и изоляция · 12. Блокировки и MVCC · 13. Журнал и восстановление</td><td><code>mvcc.py</code></td></tr>
          <tr><td>VI. Распределённость и облако</td><td>14. Распределённые БД · 15. Облачные СУБД</td><td>—</td></tr>
          <tr><td>VII. Виды баз данных</td><td>16. Обзор · 17. Колоночные · 18. Key-value и документные · 19. Графовые · 20. Векторные</td><td><code>vector_index.py</code></td></tr>
          <tr><td>VIII. Аналитика и большие данные</td><td>21. OLTP, OLAP и хранилища данных · 22. Data Lake, MapReduce, Spark, потоки · 23. Практикум</td><td><code>mapreduce.py</code></td></tr>
        </tbody>
      </table>
      <p>Нужно знать Python на базовом уровне и понимать простой SQL (<code>SELECT</code>, <code>JOIN</code>, <code>WHERE</code>). Вся математика объясняется на месте.</p>

      <h2>Код</h2>
      <p>Практическая часть — девять файлов в <code>books/db/python/</code>, только стандартная библиотека Python:</p>
      <Code lang="bash" title="терминал">{`
cd books/db/python
python btree.py    # B+-дерево: вставка, поиск, диапазоны, проверка инвариантов
python lsm.py      # LSM-хранилище: WAL, memtable, SSTable, Bloom-фильтр, компакция, восстановление
python query.py    # исполнитель запросов: итераторы, три алгоритма соединения
python mvcc.py     # MVCC: снимки, потерянное обновление, write skew, serializable
# и ещё: normalize.py, extsort.py, colcompress.py, vector_index.py, mapreduce.py — см. главу 23
`}</Code>

      <h2>Что почитать параллельно</h2>
      <ul>
        <li>Хеллерштейн, Стоунбрейкер, Гамильтон, «Architecture of a Database System» <Cite id="hellerstein2007" /> — лучший обзор устройства СУБД целиком.</li>
        <li>Курс CMU 15-445 Энди Павло <Cite id="cmu445" /> — лекции в открытом доступе.</li>
        <li>Книги «Database Internals» <Cite id="petrov2019" /> и «Designing Data-Intensive Applications» <Cite id="kleppmann2017" />.</li>
      </ul>
      <p>Начнём с того, что именно вычисляет СУБД, — с <a href="#/db/sql">реляционной модели и SQL</a>. Если вы с ними уже уверенно знакомы, можно сразу перейти к тому, <a href="#/db/storage">как данные лежат на диске</a>.</p>
    </>
  );
}
