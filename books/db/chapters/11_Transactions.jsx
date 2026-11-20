import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Stat } from '@shared/ui.jsx';
import { runSchedule } from '../lib/txsim.js';

const SCENARIOS = {
  dirty: {
    name: 'Грязное чтение',
    text: 'T1 переводит деньги и откатывается. Успеет ли T2 увидеть сумму, которой никогда не было?',
    init: { x: 100 },
    steps: [
      { t: 1, op: 'w', k: 'x', f: () => 200, sql: 'UPDATE acc SET x = 200' },
      { t: 2, op: 'r', k: 'x', sql: 'SELECT x' },
      { t: 1, op: 'a', sql: 'ROLLBACK' },
      { t: 2, op: 'c', sql: 'COMMIT' },
    ],
    check: (res) => { const v = res.log[1].out; return v.includes('200') ? 'T2 прочитала 200 — значение, которое откатили и которого «не было»' : null; },
  },
  nonrep: {
    name: 'Неповторяемое чтение',
    text: 'T1 дважды читает одну строку, между чтениями T2 её меняет.',
    init: { x: 100 },
    steps: [
      { t: 1, op: 'r', k: 'x', as: 'x1', sql: 'SELECT x' },
      { t: 2, op: 'w', k: 'x', f: () => 50, sql: 'UPDATE … SET x = 50' },
      { t: 2, op: 'c', sql: 'COMMIT' },
      { t: 1, op: 'r', k: 'x', as: 'x2', sql: 'SELECT x  (снова)' },
      { t: 1, op: 'c', sql: 'COMMIT' },
    ],
    check: (res) => (res.tx[1].vars.x1 !== res.tx[1].vars.x2 ? `T1 получила ${res.tx[1].vars.x1}, потом ${res.tx[1].vars.x2} внутри одной транзакции` : null),
  },
  phantom: {
    name: 'Фантом',
    text: 'T1 дважды считает сотрудников отдела; между подсчётами T2 добавляет нового.',
    init: { 'emp:1': 'Аня', 'emp:2': 'Борис' },
    steps: [
      { t: 1, op: 'scan', prefix: 'emp:', as: 'n1', sql: 'SELECT count(*) FROM emp' },
      { t: 2, op: 'w', k: 'emp:3', f: () => 'Вера', sql: "INSERT INTO emp VALUES ('Вера')" },
      { t: 2, op: 'c', sql: 'COMMIT' },
      { t: 1, op: 'scan', prefix: 'emp:', as: 'n2', sql: 'SELECT count(*) FROM emp  (снова)' },
      { t: 1, op: 'c', sql: 'COMMIT' },
    ],
    check: (res) => (res.tx[1].vars.n1 !== res.tx[1].vars.n2 ? `число строк изменилось: ${res.tx[1].vars.n1} → ${res.tx[1].vars.n2} — появился «фантом»` : null),
  },
  lost: {
    name: 'Потерянное обновление',
    text: 'Обе транзакции читают счётчик и записывают «прочитанное + 10».',
    init: { x: 100 },
    steps: [
      { t: 1, op: 'r', k: 'x', sql: 'SELECT x' },
      { t: 2, op: 'r', k: 'x', sql: 'SELECT x' },
      { t: 1, op: 'w', k: 'x', f: (v) => v.x + 10, sql: 'UPDATE … SET x = x_прочит + 10' },
      { t: 1, op: 'c', sql: 'COMMIT' },
      { t: 2, op: 'w', k: 'x', f: (v) => v.x + 10, sql: 'UPDATE … SET x = x_прочит + 10' },
      { t: 2, op: 'c', sql: 'COMMIT' },
    ],
    check: (res) => (res.final.x === 110 && res.tx[1].state === 'committed' && res.tx[2].state === 'committed' ? 'обе зафиксированы, но x = 110 вместо 120 — одно обновление потеряно' : null),
  },
  readskew: {
    name: 'Несогласованное чтение (read skew)',
    text: 'На двух счетах всего 100. T2 переводит 50 с A на B, пока T1 считает сумму.',
    init: { a: 50, b: 50 },
    steps: [
      { t: 1, op: 'r', k: 'a', sql: 'SELECT a' },
      { t: 2, op: 'w', k: 'a', f: () => 0, sql: 'UPDATE: a = 0' },
      { t: 2, op: 'w', k: 'b', f: () => 100, sql: 'UPDATE: b = 100' },
      { t: 2, op: 'c', sql: 'COMMIT' },
      { t: 1, op: 'r', k: 'b', sql: 'SELECT b' },
      { t: 1, op: 'c', sql: 'COMMIT' },
    ],
    check: (res) => { const s = res.tx[1].vars.a + res.tx[1].vars.b; return s !== 100 ? `T1 видит сумму ${s}, хотя деньги не создавались` : null; },
  },
  skew: {
    name: 'Write skew',
    text: 'Должен дежурить хотя бы один врач. Каждый проверяет «дежурят двое» и снимает себя.',
    init: { alice: 1, bob: 1 },
    steps: [
      { t: 1, op: 'r', k: 'alice', sql: 'SELECT дежурные' }, { t: 1, op: 'r', k: 'bob', sql: '' },
      { t: 2, op: 'r', k: 'alice', sql: 'SELECT дежурные' }, { t: 2, op: 'r', k: 'bob', sql: '' },
      { t: 1, op: 'w', k: 'alice', f: (v) => (v.alice + v.bob >= 2 ? 0 : 1), sql: 'двое → alice уходит' },
      { t: 2, op: 'w', k: 'bob', f: (v) => (v.alice + v.bob >= 2 ? 0 : 1), sql: 'двое → bob уходит' },
      { t: 1, op: 'c', sql: 'COMMIT' },
      { t: 2, op: 'c', sql: 'COMMIT' },
    ],
    check: (res) => (res.final.alice + res.final.bob === 0 ? 'обе зафиксированы — не дежурит никто: инвариант нарушен' : null),
  },
};
const LEVELS = [['RU', 'READ UNCOMMITTED'], ['RC', 'READ COMMITTED'], ['SI', 'SNAPSHOT (REPEATABLE READ в PostgreSQL)'], ['SER', 'SERIALIZABLE']];

function AnomalyPlayer() {
  const [sc, setSc] = useState('lost');
  const [lvl, setLvl] = useState('RC');
  const S = SCENARIOS[sc];
  const res = useMemo(() => runSchedule(S.init, S.steps, lvl), [sc, lvl]);
  const anomaly = S.check(res);
  return (
    <Widget title="Проигрыватель аномалий: одно расписание, разные уровни изоляции">
      <div className="controls">{Object.entries(SCENARIOS).map(([k, v]) => <button key={k} className={'btn small' + (k === sc ? ' primary' : '')} onClick={() => setSc(k)}>{v.name}</button>)}</div>
      <div className="controls">{LEVELS.map(([k, n]) => <button key={k} className={'btn small' + (k === lvl ? ' primary' : '')} onClick={() => setLvl(k)}>{n}</button>)}</div>
      <p className="small">{S.text} Начальное состояние: <span className="mono">{JSON.stringify(S.init)}</span></p>
      <table>
        <thead><tr><th style={{ width: 30 }}>#</th><th>T1</th><th>T2</th><th>результат</th></tr></thead>
        <tbody>{res.log.map((e, i) => (
          <tr key={i} style={{ background: e.abort ? 'var(--red-soft)' : undefined }}>
            <td className="muted">{i + 1}</td>
            <td className="mono small">{e.t === 1 ? e.sql || `read ${e.k}` : ''}</td>
            <td className="mono small">{e.t === 2 ? e.sql || `read ${e.k}` : ''}</td>
            <td className="mono small">T{e.t}: {e.out}</td>
          </tr>
        ))}</tbody>
      </table>
      <div className="stats">
        <Stat k="итоговое состояние" v={<span className="mono" style={{ fontSize: 14 }}>{JSON.stringify(res.final)}</span>} />
        <Stat k="вердикт" v={anomaly ? '⚠ аномалия' : '✓ корректно'} />
      </div>
      <p className="small">{anomaly || 'Результат эквивалентен последовательному выполнению транзакций (или одна из них откачена и может быть повторена).'}</p>
      <p className="small muted">Модель упрощена: уровни реализованы в стиле MVCC (как в PostgreSQL), без блокировок; одновременные незафиксированные записи одного ключа в сценариях не встречаются. SERIALIZABLE здесь — консервативная проверка прочитанного при фиксации пишущей транзакции; настоящий SSI (глава 12) точнее и откатывает реже.</p>
    </Widget>
  );
}

export default function Transactions() {
  return (
    <>
      <h1>Транзакции и изоляция</h1>
      <p className="lead">Транзакция — группа операций, которая выполняется «всё или ничего» и как будто в одиночестве. Самая тонкая часть — что значит «как будто в одиночестве» и сколько за это платить.</p>

      <h2>ACID</h2>
      <p>Акроним предложили Хердер и Ройтер <Cite id="harder1983" />:</p>
      <ul>
        <li><b>Atomicity</b> (атомарность) — либо все изменения транзакции, либо ни одного. Обеспечивается журналом и откатом (глава 13).</li>
        <li><b>Consistency</b> (согласованность) — транзакция переводит базу из корректного состояния в корректное (ограничения, инварианты приложения). Это скорее свойство приложения, которое СУБД помогает соблюдать.</li>
        <li><b>Isolation</b> (изоляция) — параллельные транзакции не мешают друг другу. Обеспечивается управлением конкурентностью (глава 12).</li>
        <li><b>Durability</b> (долговечность) — зафиксированное не теряется при сбое. Журнал и <code>fsync</code> (глава 13).</li>
      </ul>

      <h2>Сериализуемость</h2>
      <p>
        Золотой стандарт изоляции — <b>сериализуемость</b>: результат параллельного выполнения такой же, как при <i>каком-то</i> последовательном порядке транзакций <Cite id="eswaran1976" />. Практичный критерий —
        <b> конфликтная сериализуемость</b>: две операции конфликтуют, если они из разных транзакций, обращаются к одному объекту и хотя бы одна — запись. Построим граф: ребро <M t={r`T_i\to T_j`} />, если операция <M t={r`T_i`} /> конфликтует с более поздней операцией <M t={r`T_j`} />.
      </p>
      <Eq t={r`\text{расписание конфликтно сериализуемо} \iff \text{граф предшествования ацикличен}`} />
      <p>Пример: <M t={r`r_1(x)\; r_2(x)\; w_1(x)\; w_2(x)`} /> даёт рёбра <M t={r`T_2\to T_1`} /> (r₂ раньше w₁) и <M t={r`T_1\to T_2`} /> (w₁ раньше w₂) — цикл, не сериализуемо. Это и есть потерянное обновление. Подробная теория — в книге Бернштейна, Хадзилакоса и Гудмана <Cite id="bernstein1987" />.</p>

      <h2>Аномалии и уровни изоляции</h2>
      <p>
        Полная сериализуемость стоит производительности, поэтому SQL определяет более слабые уровни через запрещённые «феномены». Беренсон и др. <Cite id="berenson1995" /> показали, что определения стандарта ANSI неоднозначны и неполны,
        и описали недостающие аномалии и уровень <b>snapshot isolation</b>. Проиграйте каждый сценарий на каждом уровне:
      </p>
      <AnomalyPlayer />
      <table>
        <thead><tr><th>Аномалия</th><th>Read Uncommitted</th><th>Read Committed</th><th>Snapshot / RR в PostgreSQL</th><th>Serializable</th></tr></thead>
        <tbody>
          <tr><td>Грязное чтение</td><td>возможно</td><td>нет</td><td>нет</td><td>нет</td></tr>
          <tr><td>Неповторяемое чтение</td><td>возможно</td><td>возможно</td><td>нет</td><td>нет</td></tr>
          <tr><td>Фантом</td><td>возможно</td><td>возможно</td><td>нет (снимок)</td><td>нет</td></tr>
          <tr><td>Потерянное обновление</td><td>возможно</td><td>возможно</td><td>нет</td><td>нет</td></tr>
          <tr><td>Read skew</td><td>возможно</td><td>возможно</td><td>нет</td><td>нет</td></tr>
          <tr><td>Write skew</td><td>возможно</td><td>возможно</td><td><b>возможно</b></td><td>нет</td></tr>
        </tbody>
      </table>
      <Callout type="warn" title="Названия уровней обманчивы">
        <ul>
          <li>Уровень по умолчанию в PostgreSQL и Oracle — <b>Read Committed</b>, в MySQL/InnoDB — <b>Repeatable Read</b>. Большинство приложений работает не на Serializable и подвержено части аномалий.</li>
          <li>«Repeatable Read» в PostgreSQL — это snapshot isolation; в InnoDB — тоже снимок для обычных чтений, но с блокировками для <code>SELECT … FOR UPDATE</code> и записей. Поведение одного и того же названия в разных СУБД различается.</li>
          <li>Oracle долгое время называл Serializable то, что на деле было snapshot isolation и допускало write skew.</li>
        </ul>
      </Callout>
      <h3>Как защититься без Serializable</h3>
      <ul>
        <li>Атомарные операции: <code>UPDATE acc SET x = x + 10</code> вместо «прочитать в приложении — записать».</li>
        <li>Явные блокировки: <code>SELECT … FOR UPDATE</code> блокирует прочитанные строки до конца транзакции — против потерянных обновлений и write skew.</li>
        <li>Ограничения в схеме (<code>UNIQUE</code>, <code>CHECK</code>, <code>EXCLUDE</code>) — СУБД проверит инвариант сама.</li>
        <li>Включить <code>SERIALIZABLE</code> и уметь <b>повторять</b> транзакции при ошибке сериализации (SQLSTATE 40001).</li>
      </ul>
      <Code title="python — повтор транзакции при ошибке сериализации (psycopg)">{`
import psycopg
from psycopg import errors

def transfer(conn, src, dst, amount, retries=5):
    for attempt in range(retries):
        try:
            with conn.transaction():
                conn.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                (bal,) = conn.execute("SELECT balance FROM acc WHERE id = %s", (src,)).fetchone()
                if bal < amount:
                    raise ValueError("недостаточно средств")
                conn.execute("UPDATE acc SET balance = balance - %s WHERE id = %s", (amount, src))
                conn.execute("UPDATE acc SET balance = balance + %s WHERE id = %s", (amount, dst))
            return
        except errors.SerializationFailure:
            continue          # СУБД откатила нас из-за конфликта — безопасно попробовать снова
    raise RuntimeError("не удалось выполнить перевод")
`}</Code>
      <Quiz q="Snapshot isolation допускает write skew. Почему правило «первый зафиксировавший побеждает» его не ловит?" options={['Оно отключено по умолчанию', 'Транзакции пишут РАЗНЫЕ строки (alice и bob), конфликта записи нет — нарушение возникает из-за того, что каждая читала то, что писала другая', 'Из-за грязного чтения', 'Write skew возникает только в распределённых БД']} answer={1}
        explain="SI проверяет только пересечение множеств записи. Для write skew нужен анализ зависимостей «прочитал — записал» (SSI)." />
    </>
  );
}
