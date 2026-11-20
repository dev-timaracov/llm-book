import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget } from '@shared/ui.jsx';
import { Rel, RA } from '../lib/rel.jsx';

const STUDENTS = { cols: ['sid', 'name', 'grp'], rows: [[1, 'Аня', 'ИУ-1'], [2, 'Борис', 'ИУ-1'], [3, 'Вера', 'ИУ-2'], [4, 'Глеб', 'ИУ-2'], [5, 'Даша', 'ИУ-1']] };
const ENROLL = { cols: ['sid', 'course', 'mark'], rows: [[1, 'БД', 5], [1, 'ОС', 4], [1, 'Сети', 5], [2, 'БД', 3], [2, 'ОС', 5], [3, 'БД', 4], [3, 'ОС', 4], [3, 'Сети', 3], [4, 'Сети', 5], [5, 'БД', null]] };
const COURSES = { cols: ['course'], rows: [['БД'], ['ОС'], ['Сети']] };

const OPS = [
  { k: 'σ', name: 'Выборка σ', tex: r`\sigma_{mark \ge 4}(\text{Enroll})`, sql: 'SELECT * FROM enroll WHERE mark >= 4', run: () => RA.select(ENROLL, (t) => t.mark !== null && t.mark >= 4) },
  { k: 'π', name: 'Проекция π', tex: r`\pi_{grp}(\text{Students})`, sql: 'SELECT DISTINCT grp FROM students', run: () => RA.project(STUDENTS, ['grp']), note: 'В алгебре отношение — множество: дубликаты исчезают. SQL по умолчанию работает с мультимножествами — нужен DISTINCT.' },
  { k: '×', name: 'Декартово произведение ×', tex: r`\pi_{name}(\text{Students}) \times \text{Courses}`, sql: 'SELECT s.name, c.course FROM students s CROSS JOIN courses c', run: () => RA.product(RA.project(STUDENTS, ['name']), COURSES), note: '5 × 3 = 15 строк: каждая с каждой.' },
  { k: '⋈', name: 'Соединение ⋈', tex: r`\text{Students} \bowtie \text{Enroll}`, sql: 'SELECT * FROM students NATURAL JOIN enroll', run: () => RA.natjoin(STUDENTS, ENROLL), note: 'Соединение = произведение + выборка по равенству общих столбцов + проекция: R ⋈ S = π(σ(R × S)).' },
  { k: '∪', name: 'Объединение ∪', tex: r`\pi_{sid}(\sigma_{course='БД'}E) \cup \pi_{sid}(\sigma_{course='Сети'}E)`, sql: "SELECT sid FROM enroll WHERE course='БД'\nUNION\nSELECT sid FROM enroll WHERE course='Сети'", run: () => RA.union(RA.project(RA.select(ENROLL, (t) => t.course === 'БД'), ['sid']), RA.project(RA.select(ENROLL, (t) => t.course === 'Сети'), ['sid'])) },
  { k: '−', name: 'Разность −', tex: r`\pi_{sid}(\text{Students}) - \pi_{sid}(\sigma_{course='БД'}E)`, sql: "SELECT sid FROM students\nEXCEPT\nSELECT sid FROM enroll WHERE course='БД'", run: () => RA.difference(RA.project(STUDENTS, ['sid']), RA.project(RA.select(ENROLL, (t) => t.course === 'БД'), ['sid'])), note: 'Кто не записан на «БД». Разность — единственный способ выразить «не» в базовой алгебре.' },
  { k: '÷', name: 'Деление ÷', tex: r`\pi_{sid,course}(E) \div \text{Courses}`, sql: "SELECT sid FROM students s WHERE NOT EXISTS (\n  SELECT * FROM courses c WHERE NOT EXISTS (\n    SELECT * FROM enroll e WHERE e.sid = s.sid AND e.course = c.course))", run: () => RA.divide(RA.project(ENROLL, ['sid', 'course']), COURSES), note: '«Записан на ВСЕ курсы». В SQL нет оператора деления — пишут двойное NOT EXISTS: «нет такого курса, на который студент не записан».' },
  { k: 'γ', name: 'Группировка γ', tex: r`\gamma_{course;\;\mathrm{count}(*),\,\mathrm{avg}(mark)}(\text{Enroll})`, sql: 'SELECT course, count(*), avg(mark) FROM enroll GROUP BY course', run: () => RA.group(ENROLL, ['course'], [{ name: 'count', fn: 'count' }, { name: 'avg', fn: 'avg', col: 'mark' }]), note: 'avg игнорирует NULL: у «БД» четыре строки, но среднее считается по трём оценкам.' },
];

function AlgebraWidget() {
  const [k, setK] = useState('⋈');
  const op = OPS.find((o) => o.k === k);
  const res = op.run();
  return (
    <Widget title="Реляционная алгебра на живых таблицах">
      <div className="controls">{OPS.map((o) => <button key={o.k} className={'btn small' + (o.k === k ? ' primary' : '')} onClick={() => setK(o.k)}>{o.name}</button>)}</div>
      <div><Rel rel={STUDENTS} title="Students" /><Rel rel={ENROLL} title="Enroll (E)" /><Rel rel={COURSES} title="Courses" /></div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6 }}>
        <M t={op.tex} />
        <Code lang="sql" title="SQL">{op.sql}</Code>
        <Rel rel={res} title="Результат" />
        {op.note && <p className="small muted">{op.note}</p>}
      </div>
    </Widget>
  );
}

// ---------- логический порядок выполнения SELECT ----------
function OrderWidget() {
  const [step, setStep] = useState(0);
  const joined = RA.natjoin(STUDENTS, ENROLL);
  const where = RA.select(joined, (t) => t.mark !== null);
  const grouped = RA.group(where, ['grp'], [{ name: 'n', fn: 'count' }, { name: 'avg_mark', fn: 'avg', col: 'mark' }]);
  const having = RA.select(grouped, (t) => t.n >= 3);
  const selected = RA.project(having, ['grp', 'avg_mark'], false);
  const ordered = RA.sort(selected, 'avg_mark', true);
  const limited = RA.limit(ordered, 1);
  const steps = [
    ['1. FROM students JOIN enroll USING (sid)', joined, 'Сначала строится источник строк: соединение таблиц.'],
    ['2. WHERE mark IS NOT NULL', where, 'Фильтр отдельных строк. Здесь ещё нет групп — поэтому в WHERE нельзя писать count(*).'],
    ['3. GROUP BY grp', grouped, 'Строки сворачиваются в группы; агрегаты считаются по группам.'],
    ['4. HAVING count(*) >= 3', having, 'Фильтр уже групп. Это «WHERE после GROUP BY».'],
    ['5. SELECT grp, avg(mark) AS avg_mark', selected, 'Только теперь вычисляются выражения списка выборки и появляются псевдонимы.'],
    ['6. ORDER BY avg_mark DESC', ordered, 'Сортировка может ссылаться на псевдонимы из SELECT — он уже выполнен.'],
    ['7. LIMIT 1', limited, 'Отрезаем первые строки.'],
  ];
  const [t, rel, note] = steps[step];
  return (
    <Widget title="В каком порядке «выполняется» SELECT">
      <Code lang="sql" title="запрос">{`SELECT grp, avg(mark) AS avg_mark
FROM students JOIN enroll USING (sid)
WHERE mark IS NOT NULL
GROUP BY grp
HAVING count(*) >= 3
ORDER BY avg_mark DESC
LIMIT 1;`}</Code>
      <div className="controls">
        <button className="btn" onClick={() => setStep(Math.max(0, step - 1))}>← назад</button>
        <button className="btn primary" onClick={() => setStep(Math.min(steps.length - 1, step + 1))}>шаг →</button>
        <b className="mono small">{t}</b>
      </div>
      <Rel rel={rel} />
      <p className="small">{note}</p>
      <p className="small muted">Это логический порядок — смысл запроса. Физический план (глава 8) может выполнять всё иначе, если результат тот же: например, фильтровать до соединения.</p>
    </Widget>
  );
}

// ---------- соединения ----------
const A = { cols: ['id', 'name'], rows: [[1, 'Аня'], [2, 'Борис'], [3, 'Вера'], [null, 'Гость']] };
const B = { cols: ['uid', 'order'], rows: [[1, 'книга'], [1, 'ручка'], [3, 'лампа'], [7, 'стол']] };
const JOINS = [
  ['inner', 'INNER JOIN', 'только пары с совпадением'],
  ['left', 'LEFT JOIN', 'все строки слева; где пары нет — NULL справа'],
  ['right', 'RIGHT JOIN', 'все строки справа'],
  ['full', 'FULL JOIN', 'все строки обеих таблиц'],
  ['semi', 'полусоединение (EXISTS / IN)', 'строки слева, у которых ЕСТЬ пара; без дублей и без столбцов справа'],
  ['anti', 'антисоединение (NOT EXISTS)', 'строки слева, у которых пары НЕТ'],
];
function JoinWidget() {
  const [k, setK] = useState('left');
  const j = JOINS.find((x) => x[0] === k);
  const sql = k === 'semi' ? 'SELECT * FROM users u WHERE EXISTS (SELECT 1 FROM orders o WHERE o.uid = u.id)'
    : k === 'anti' ? 'SELECT * FROM users u WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.uid = u.id)'
      : `SELECT * FROM users u ${j[1]} orders o ON o.uid = u.id`;
  return (
    <Widget title="Виды соединений">
      <div className="controls">{JOINS.map(([key, n]) => <button key={key} className={'btn small' + (key === k ? ' primary' : '')} onClick={() => setK(key)}>{n}</button>)}</div>
      <Rel rel={A} title="users" /><Rel rel={B} title="orders" />
      <Code lang="sql" title="SQL">{sql}</Code>
      <Rel rel={RA.join(A, B, 'id', 'uid', k)} title="результат" />
      <p className="small muted">{j[2]}. Обратите внимание: «Гость» с id = NULL не соединяется ни с чем — NULL не равен даже NULL.</p>
    </Widget>
  );
}

// ---------- трёхзначная логика ----------
const V = [true, false, null];
const show = (v) => (v === null ? 'NULL' : v ? 'TRUE' : 'FALSE');
const and3 = (a, b) => (a === false || b === false ? false : a === null || b === null ? null : true);
const or3 = (a, b) => (a === true || b === true ? true : a === null || b === null ? null : false);
function NullWidget() {
  return (
    <Widget title="NULL и трёхзначная логика">
      <div className="row">
        {[['AND', and3], ['OR', or3]].map(([n, f]) => (
          <table key={n} className="small" style={{ display: 'table', width: 'auto' }}>
            <thead><tr><th>{n}</th>{V.map((b) => <th key={String(b)}>{show(b)}</th>)}</tr></thead>
            <tbody>{V.map((a) => <tr key={String(a)}><th>{show(a)}</th>{V.map((b) => { const v = f(a, b); return <td key={String(b)} style={{ background: v === null ? 'var(--amber-soft)' : undefined }}>{show(v)}</td>; })}</tr>)}</tbody>
          </table>
        ))}
        <table className="small" style={{ display: 'table', width: 'auto' }}>
          <thead><tr><th>x</th><th>NOT x</th></tr></thead>
          <tbody>{V.map((a) => <tr key={String(a)}><td>{show(a)}</td><td>{show(a === null ? null : !a)}</td></tr>)}</tbody>
        </table>
      </div>
      <ul className="small">
        <li><code>NULL = NULL</code> → NULL (неизвестно), поэтому проверяют <code>IS NULL</code>.</li>
        <li><code>WHERE</code> оставляет только строки, где условие TRUE: строки с NULL отбрасываются и из <code>mark &gt;= 4</code>, и из <code>NOT (mark &gt;= 4)</code>.</li>
        <li>Ловушка: <code>WHERE sid NOT IN (SELECT sid FROM t)</code> вернёт <b>пустой</b> результат, если в подзапросе есть хоть один NULL: <code>x &lt;&gt; NULL</code> — неизвестно. Используйте <code>NOT EXISTS</code>.</li>
        <li><code>count(*)</code> считает строки, <code>count(mark)</code> — только не-NULL значения; <code>sum</code>/<code>avg</code> NULL пропускают.</li>
      </ul>
    </Widget>
  );
}

export default function SQLChapter() {
  return (
    <>
      <h1>SQL и реляционная алгебра</h1>
      <p className="lead">Прежде чем лезть внутрь СУБД, нужно точно понимать, что она вычисляет. Реляционная модель даёт строгий язык — алгебру, а SQL — её практичную (и не всегда строгую) запись.</p>

      <h2>Реляционная модель</h2>
      <p>Кодд <Cite id="codd1970" /> предложил описывать данные математическими отношениями:</p>
      <ul>
        <li><b>Домен</b> — множество допустимых значений (целые, строки, даты).</li>
        <li><b>Отношение</b> <M t={r`R \subseteq D_1\times D_2\times\dots\times D_n`} /> — множество кортежей; на практике — таблица. Порядок строк и столбцов значения не имеет, дубликатов нет.</li>
        <li><b>Схема</b> <M t={r`R(A_1, \dots, A_n)`} /> — имя отношения и его атрибуты.</li>
        <li><b>Ключи.</b> Суперключ — набор атрибутов, однозначно определяющий кортеж; <b>потенциальный ключ</b> — минимальный суперключ; <b>первичный</b> — выбранный из потенциальных; <b>внешний ключ</b> — атрибуты, значения которых обязаны встречаться в ключе другого отношения (ссылочная целостность).</li>
      </ul>
      <p>
        Главная идея — <b>независимость данных</b>: программа говорит, <i>какие</i> данные ей нужны, а не <i>как</i> их найти. До Кодда базы были иерархическими и сетевыми, и программы ходили по указателям вручную; любая реорганизация хранения ломала приложения.
      </p>

      <h2>Реляционная алгебра</h2>
      <p>Операции принимают отношения и возвращают отношения (алгебра замкнута) — поэтому их можно вкладывать друг в друга. Базовый набор: <M t={r`\sigma`} /> (выборка), <M t={r`\pi`} /> (проекция), <M t={r`\times`} /> (произведение), <M t={r`\cup`} />, <M t={r`-`} />, <M t={r`\rho`} /> (переименование). Остальные выражаются через них:</p>
      <Eq t={r`R\bowtie_{\theta}S = \sigma_{\theta}(R\times S),\qquad R\cap S = R - (R - S),\qquad R\div S = \pi_X(R) - \pi_X\big((\pi_X(R)\times S) - R\big)`} />
      <AlgebraWidget />
      <p>
        Наравне с алгеброй (процедурный язык: «как вычислить») Кодд ввёл <b>реляционное исчисление</b> — декларативный язык логических формул («что вычислить»), и доказал их эквивалентность по выразительности.
        На этом и держится оптимизатор (глава 10): декларативный запрос переводится в алгебраическое выражение, а затем переписывается в эквивалентные, более дешёвые. Строгое изложение — в книге Абитебула, Халла и Виану <Cite id="abiteboul1995" />.
      </p>
      <Callout type="note" title="Полезные тождества — то, чем пользуется оптимизатор">
        <ul>
          <li>Проталкивание выборки: <M t={r`\sigma_{p}(R\bowtie S) = \sigma_{p}(R)\bowtie S`} />, если <M t="p" /> зависит только от столбцов <M t="R" />.</li>
          <li>Каскад выборок: <M t={r`\sigma_{p\wedge q}(R) = \sigma_p(\sigma_q(R))`} />.</li>
          <li>Коммутативность и ассоциативность соединения: <M t={r`R\bowtie S = S\bowtie R`} />, <M t={r`(R\bowtie S)\bowtie T = R\bowtie(S\bowtie T)`} /> — отсюда выбор порядка соединений.</li>
        </ul>
      </Callout>

      <h2>От алгебры к SQL</h2>
      <p>
        SQL родился в System R как SEQUEL <Cite id="chamberlin1974" />. Он ближе к исчислению, чем к алгебре, и отступает от модели в нескольких важных местах:
      </p>
      <ul>
        <li><b>Мультимножества.</b> Таблица может содержать одинаковые строки; <code>SELECT</code> не убирает дубликаты без <code>DISTINCT</code>, <code>UNION ALL</code> их сохраняет. Причина практическая — устранение дубликатов требует сортировки или хеширования.</li>
        <li><b>NULL</b> — «значение отсутствует или неизвестно» и трёхзначная логика (Кодд ввёл её позже <Cite id="codd1979" />).</li>
        <li><b>Порядок</b>: <code>ORDER BY</code> и <code>LIMIT</code> — уже не операции над множествами.</li>
      </ul>
      <OrderWidget />

      <h3>Соединения</h3>
      <JoinWidget />

      <h3>NULL</h3>
      <NullWidget />

      <h2>Подзапросы, CTE и рекурсия</h2>
      <p>
        Подзапрос может стоять в <code>FROM</code> (производная таблица), в <code>WHERE</code> (<code>IN</code>, <code>EXISTS</code>, сравнение со скаляром) и даже в <code>SELECT</code>. <b>Коррелированный</b> подзапрос ссылается на внешнюю строку и логически выполняется для каждой из них; хорошие оптимизаторы превращают его в полу- или антисоединение. <code>WITH</code> (CTE) даёт имена промежуточным результатам, а <code>WITH RECURSIVE</code> позволяет то, чего нет в реляционной алгебре: транзитивное замыкание — «все подчинённые подчинённых», «все пути в графе».
      </p>

      <h2>Оконные функции</h2>
      <p>
        <code>GROUP BY</code> сворачивает строки. Оконная функция считает агрегат по «окну» связанных строк, <b>не сворачивая</b> их: место в рейтинге, накопительная сумма, скользящее среднее, разница с предыдущей строкой.
        Синтаксис: <code>функция() OVER (PARTITION BY … ORDER BY … ROWS BETWEEN …)</code>. Эффективные алгоритмы вычисления окон (сегментные деревья для произвольных рамок) описаны у Лейса и др. <Cite id="leis2015window" />.
      </p>
      <Code title="python — проверяем всё на SQLite (входит в стандартную библиотеку)">{`
import sqlite3

db = sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE students (sid INTEGER PRIMARY KEY, name TEXT, grp TEXT);
CREATE TABLE enroll (sid INTEGER REFERENCES students, course TEXT, mark INTEGER);
INSERT INTO students VALUES (1,'Аня','ИУ-1'),(2,'Борис','ИУ-1'),(3,'Вера','ИУ-2'),(4,'Глеб','ИУ-2'),(5,'Даша','ИУ-1');
INSERT INTO enroll VALUES (1,'БД',5),(1,'ОС',4),(1,'Сети',5),(2,'БД',3),(2,'ОС',5),
                          (3,'БД',4),(3,'ОС',4),(3,'Сети',3),(4,'Сети',5),(5,'БД',NULL);
CREATE TABLE emp (id INTEGER PRIMARY KEY, name TEXT, boss INTEGER);
INSERT INTO emp VALUES (1,'CEO',NULL),(2,'CTO',1),(3,'Тимлид',2),(4,'Разработчик',3),(5,'CFO',1);
""")

# деление: кто записан на все курсы
print(db.execute("""
SELECT name FROM students s WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT DISTINCT course FROM enroll) c WHERE NOT EXISTS (
    SELECT 1 FROM enroll e WHERE e.sid = s.sid AND e.course = c.course))""").fetchall())
# [('Аня',), ('Вера',)]

# ловушка NOT IN + NULL
print(db.execute("SELECT count(*) FROM students WHERE sid NOT IN (SELECT mark FROM enroll)").fetchall())
# [(0,)] — из-за единственного NULL в mark; с NOT EXISTS было бы 2 (sid 1 и 2)

# оконные функции: рейтинг внутри курса и разница со средним
for row in db.execute("""
SELECT course, sid, mark,
       rank() OVER (PARTITION BY course ORDER BY mark DESC) AS place,
       round(mark - avg(mark) OVER (PARTITION BY course), 2) AS vs_avg
FROM enroll WHERE mark IS NOT NULL ORDER BY course, place"""):
    print(row)

# рекурсивный CTE: вся цепочка начальников разработчика
print(db.execute("""
WITH RECURSIVE chain(id, name, boss, depth) AS (
  SELECT id, name, boss, 0 FROM emp WHERE name = 'Разработчик'
  UNION ALL
  SELECT e.id, e.name, e.boss, c.depth + 1 FROM emp e JOIN chain c ON e.id = c.boss)
SELECT name, depth FROM chain""").fetchall())
# [('Разработчик', 0), ('Тимлид', 1), ('CTO', 2), ('CEO', 3)]
`}</Code>
      <Quiz q="Почему в WHERE нельзя использовать count(*), а в HAVING можно?" options={['Так решили авторы стандарта случайно', 'WHERE фильтрует отдельные строки до группировки — групп ещё нет; HAVING фильтрует уже сформированные группы', 'count(*) медленный', 'Можно и там, и там']} answer={1}
        explain="Логический порядок: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT." />
      <Quiz q="Как в реляционной алгебре выразить «студенты, записанные на все курсы»?" options={['Объединением', 'Делением ÷', 'Проекцией', 'Это невыразимо']} answer={1}
        explain="Деление выражается через разность, произведение и проекцию; в SQL — двойным NOT EXISTS." />
    </>
  );
}
