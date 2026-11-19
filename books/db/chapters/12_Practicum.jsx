import React from 'react';
import { Cite, Callout, Code, Quiz } from '@shared/ui.jsx';

export default function Practicum() {
  return (
    <>
      <h1>Практикум</h1>
      <p className="lead">Четыре программы из учебника — маленькие, но настоящие версии ключевых частей СУБД. Запустите их, сломайте, расширьте. А затем загляните внутрь настоящего PostgreSQL и найдите там всё то же самое.</p>

      <h2>Шаг 1. Запуск</h2>
      <p>Нужен только Python 3.8+ — сторонних библиотек нет.</p>
      <Code lang="bash" title="терминал">{`
cd books/db/python
python btree.py
python lsm.py
python query.py
python mvcc.py
`}</Code>
      <table>
        <thead><tr><th>Файл</th><th>Что внутри</th><th>Глава</th><th>Что проверяет при запуске</th></tr></thead>
        <tbody>
          <tr><td><code>btree.py</code></td><td>B+-дерево: поиск, вставка с делением узлов, диапазоны по связанным листьям</td><td>3</td><td>инварианты после каждой из 2000 вставок; высота при порядке 4…400</td></tr>
          <tr><td><code>lsm.py</code></td><td>WAL + fsync, memtable, SSTable с разреженным индексом, Bloom-фильтр, компакция, надгробия</td><td>4, 9</td><td>данные после «падения» совпадают; доля ложных срабатываний Bloom ≈ 1%</td></tr>
          <tr><td><code>query.py</code></td><td>исполнитель Volcano: Scan, Filter, Project, три соединения, Sort, HashAggregate, Limit; EXPLAIN</td><td>5, 6</td><td>три алгоритма соединения дают одинаковый ответ; число сравнений</td></tr>
          <tr><td><code>mvcc.py</code></td><td>версии с xmin/xmax, снимки, first-committer-wins, проверка прочитанного</td><td>7, 8</td><td>потерянное обновление предотвращено; write skew при SI и его отсутствие при SERIALIZABLE</td></tr>
        </tbody>
      </table>
      <p>Реальный вывод <code>btree.py</code>:</p>
      <Code lang="bash" title="вывод">{`
order=4: 2000 ключей, высота 7; инварианты выполняются
order=   4: высота 11, чтений страниц на поиск: 11.0
order=  16: высота 6, чтений страниц на поиск: 6.0
order= 128: высота 4, чтений страниц на поиск: 4.0
order= 400: высота 3, чтений страниц на поиск: 3.0
`}</Code>

      <h2>Шаг 2. Упражнения</h2>
      <h3>B+-дерево</h3>
      <ol>
        <li>Реализуйте <code>delete</code> с заимствованием у соседа и слиянием узлов; добавьте проверку в <code>check()</code>.</li>
        <li>Сделайте дерево дисковым: узел = страница фиксированного размера в файле (<code>struct</code> из главы 1), чтение через буферный пул с LRU из главы 2. Посчитайте реальные чтения с диска.</li>
        <li>Вставьте миллион ключей по возрастанию и измерьте среднюю заполненность листьев. Измените деление «правого края» так, чтобы листья были заполнены почти полностью.</li>
      </ol>
      <h3>LSM</h3>
      <ol>
        <li>Добавьте <code>scan(lo, hi)</code>: слияние отсортированных итераторов memtable и всех SSTable (<code>heapq.merge</code>) с учётом версий и надгробий.</li>
        <li>Замените «слить всё» на leveling с коэффициентом T и сравните усиление записи с симулятором из главы 4.</li>
        <li>Тест на сбой: запускайте запись в отдельном процессе, убивайте его <code>kill -9</code> в случайный момент и проверяйте, что все подтверждённые ключи на месте.</li>
      </ol>
      <h3>Запросы</h3>
      <ol>
        <li>Добавьте индексный вложенный цикл, используя <code>BPlusTree</code> из <code>btree.py</code> как индекс.</li>
        <li>Напишите крошечный разборщик SQL для <code>SELECT … FROM … JOIN … WHERE … GROUP BY</code>, строящий план из операторов <code>query.py</code>.</li>
        <li>Перепишите Filter и Project в векторном стиле (обработка пачек по 1024 строки в виде столбцов) и сравните скорость с построчной версией.</li>
      </ol>
      <h3>Транзакции</h3>
      <ol>
        <li>Добавьте в <code>mvcc.py</code> сборку мусора: удалять версии, невидимые ни одному активному снимку.</li>
        <li>Реализуйте строгую 2PL с обнаружением взаимоблокировок по графу ожиданий и сравните её с MVCC на сценариях главы 7.</li>
      </ol>

      <h2>Шаг 3. Заглядываем внутрь PostgreSQL</h2>
      <p>Всё, что мы писали, есть в настоящей СУБД, и до многого можно дотянуться прямо из SQL.</p>
      <Code lang="bash" title="psql">{`
CREATE TABLE acc (id int PRIMARY KEY, balance int);
INSERT INTO acc SELECT g, 100 FROM generate_series(1, 100000) g;
ANALYZE acc;

-- глава 1: адрес строки (страница, слот) и размер страницы
SELECT ctid, * FROM acc LIMIT 3;               -- (0,1), (0,2), ...
SHOW block_size;                               -- 8192

-- глава 8: служебные поля MVCC
SELECT xmin, xmax, ctid, * FROM acc WHERE id = 1;
UPDATE acc SET balance = 90 WHERE id = 1;
SELECT xmin, xmax, ctid, * FROM acc WHERE id = 1;   -- новый xmin и новый ctid: это новая версия строки

-- глава 3: структура B+-дерева первичного ключа
CREATE EXTENSION pageinspect;
SELECT * FROM bt_metap('acc_pkey');            -- корень и число уровней (level)
SELECT * FROM bt_page_stats('acc_pkey', 1);    -- статистика страницы индекса

-- глава 6: план и оценки
EXPLAIN ANALYZE SELECT * FROM acc WHERE id BETWEEN 10 AND 20;
SELECT attname, n_distinct, most_common_vals, histogram_bounds FROM pg_stats WHERE tablename = 'acc';

-- глава 2: попадания в буферный пул
SELECT heap_blks_read, heap_blks_hit FROM pg_statio_user_tables WHERE relname = 'acc';

-- глава 9: позиция в журнале
SELECT pg_current_wal_lsn();
`}</Code>
      <Callout type="tip" title="Куда двигаться дальше">
        <ul>
          <li>Курс CMU 15-445/645 <Cite id="cmu445" />: лабораторные строят СУБД BusTub на C++ — буферный пул, B+-дерево, исполнитель, блокировки.</li>
          <li>Исходники SQLite — одна из самых читаемых промышленных СУБД (B-дерево в <code>btree.c</code>, страничный кэш в <code>pager.c</code>).</li>
          <li>Книги «Database Internals» <Cite id="petrov2019" /> (хранение и распределённость) и «Designing Data-Intensive Applications» <Cite id="kleppmann2017" /> (архитектура систем).</li>
          <li>Обзор архитектуры Хеллерштейна и др. <Cite id="hellerstein2007" /> — теперь вы поймёте каждую его страницу.</li>
        </ul>
      </Callout>
      <Quiz q="После UPDATE в PostgreSQL у строки изменился ctid. Что это значит?" options={['Строка удалена', 'Создана новая версия строки в другом месте таблицы (MVCC append-only), старая останется до VACUUM', 'Сломался индекс', 'Произошла контрольная точка']} answer={1}
        explain="PostgreSQL не обновляет строки на месте: UPDATE = новая версия + пометка xmax у старой." />
    </>
  );
}
